import { IncomingMessage, Server as HttpServer } from 'http';
import { RawData, WebSocketServer, WebSocket } from 'ws';
import { getStockDetail } from '../services/stock-detail.service';
import { HttpError } from '../utils/http-error';
import { StockDetailDto } from '../models/stock-detail';

type ClientMessage =
  | { type: 'subscribe'; symbol: string; intervalMs?: number }
  | { type: 'ping' };

type Subscription = {
  symbol: string;
  intervalMs: number;
  timer?: NodeJS.Timeout;
};

// Chaos mode configuration - simulates real-world feed conditions
const CHAOS = {
  // Burst mode: rapid succession of messages during high volatility
  BURST_CHANCE: 0.10,
  BURST_SIZE_MIN: 5,
  BURST_SIZE_MAX: 15,
  BURST_DELAY_MS: 10,

  // Duplicate messages: client must dedupe by timestamp
  DUPLICATE_CHANCE: 0.08,
  DUPLICATE_COUNT_MAX: 3,

  // Out-of-order delivery: messages arrive late
  OUT_OF_ORDER_CHANCE: 0.05,
  OUT_OF_ORDER_DELAY_MIN_MS: 100,
  OUT_OF_ORDER_DELAY_MAX_MS: 500,

  // Corrupted JSON: malformed messages
  CORRUPT_CHANCE: 0.03,

  // Heartbeat gaps: dropped pong responses
  HEARTBEAT_DROP_CHANCE: 0.10,

  // Variable rate spikes: temporary fast mode
  SPIKE_CHANCE: 0.05,
  SPIKE_INTERVAL_MS: 75,
  SPIKE_DURATION_MS: 8000,
};

type ConnectionState = {
  inSpikeMode: boolean;
  spikeEndTime: number;
};

const DISCONNECT_MIN_MS = 45_000;
const DISCONNECT_MAX_MS = 120_000;

export function attachWebSocketServer(server: HttpServer): void {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket, req) => {
    const { pathname, symbolFromQuery } = parseWsRequest(req);
    if (!pathname || !isAllowedPath(pathname)) {
      socket.close(1008, 'Invalid WebSocket path');
      return;
    }

    const subscription: Subscription = { symbol: symbolFromQuery ?? '', intervalMs: 1000 };
    const connState: ConnectionState = { inSpikeMode: false, spikeEndTime: 0 };
    let closed = false;
    let disconnectTimer: NodeJS.Timeout | undefined;

    socket.send(JSON.stringify({ type: 'ready', message: 'Connected to stock feed' }));
    scheduleDisconnect(socket);
    if (subscription.symbol) {
      void restartStream(socket, subscription);
    }

    socket.on('message', (raw) => {
      const message = parseMessage(raw);
      if (!message) {
        return socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
      if (message.type === 'ping') {
        // Chaos: randomly drop heartbeat responses
        if (Math.random() < CHAOS.HEARTBEAT_DROP_CHANCE) {
          return; // Silently drop the pong
        }
        return socket.send(JSON.stringify({ type: 'pong', at: Date.now() }));
      }
      if (message.type === 'subscribe') {
        subscription.symbol = message.symbol.trim().toUpperCase();
        subscription.intervalMs = clampNumber(message.intervalMs, 700, 10000, 1000);
        restartStream(socket, subscription).catch((error) => {
          handleError(socket, error);
        });
      }
    });

    socket.on('close', () => {
      closed = true;
      stopStream(subscription);
      clearDisconnect();
    });

    socket.on('error', () => {
      closed = true;
      stopStream(subscription);
      clearDisconnect();
    });

    async function restartStream(ws: WebSocket, sub: Subscription): Promise<void> {
      stopStream(sub);
      if (!sub.symbol) {
        ws.send(JSON.stringify({ type: 'error', message: 'Symbol is required for subscription' }));
        return;
      }
      await pushUpdate(ws, sub.symbol);
      if (closed) return;
      scheduleNext(ws, sub);
    }

    function scheduleNext(ws: WebSocket, sub: Subscription): void {
      // Check/update spike mode
      const now = Date.now();
      if (connState.inSpikeMode && now >= connState.spikeEndTime) {
        connState.inSpikeMode = false;
      }
      if (!connState.inSpikeMode && Math.random() < CHAOS.SPIKE_CHANCE) {
        connState.inSpikeMode = true;
        connState.spikeEndTime = now + CHAOS.SPIKE_DURATION_MS;
      }

      // Determine interval based on spike mode
      const baseInterval = connState.inSpikeMode ? CHAOS.SPIKE_INTERVAL_MS : sub.intervalMs;
      const nextDelay = pickNextDelay(baseInterval);

      sub.timer = setTimeout(() => {
        if (closed) return;
        scheduleNext(ws, sub);

        // Chaos: burst mode - send multiple messages rapidly
        if (Math.random() < CHAOS.BURST_CHANCE) {
          const burstSize = Math.floor(randBetween(CHAOS.BURST_SIZE_MIN, CHAOS.BURST_SIZE_MAX + 1));
          for (let i = 0; i < burstSize; i++) {
            setTimeout(() => {
              if (!closed) void pushUpdateWithChaos(ws, sub.symbol);
            }, i * CHAOS.BURST_DELAY_MS);
          }
        } else {
          void pushUpdateWithChaos(ws, sub.symbol);
        }
      }, nextDelay);
    }

    function scheduleDisconnect(ws: WebSocket): void {
      clearDisconnect();
      const ms = Math.round(randBetween(DISCONNECT_MIN_MS, DISCONNECT_MAX_MS));
      disconnectTimer = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'serverReset', reason: 'Simulated restart' }));
          ws.close(1012, 'Service restart');
        }
      }, ms);
    }

    function clearDisconnect(): void {
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = undefined;
      }
    }
  });
}

type StockQuoteMessage = {
  type: 'stockQuote';
  symbol: string;
  data: {
    price: number;
    timestamp: number;
  };
};

async function pushUpdate(ws: WebSocket, symbol: string): Promise<void> {
  try {
    const detail = await getStockDetail(symbol);
    const payload: StockQuoteMessage = {
      type: 'stockQuote',
      symbol,
      data: {
        price: detail.price,
        timestamp: detail.updatedAt,
      }
    };
    ws.send(JSON.stringify(payload));
  } catch (error) {
    handleError(ws, error);
  }
}

async function pushUpdateWithChaos(ws: WebSocket, symbol: string): Promise<void> {
  try {
    const detail = await getStockDetail(symbol);
    const payload: StockQuoteMessage = {
      type: 'stockQuote',
      symbol,
      data: {
        price: detail.price,
        timestamp: detail.updatedAt,
      }
    };
    const jsonPayload = JSON.stringify(payload);

    // Chaos: out-of-order delivery - delay some messages
    const isOutOfOrder = Math.random() < CHAOS.OUT_OF_ORDER_CHANCE;
    const outOfOrderDelay = isOutOfOrder
      ? Math.round(randBetween(CHAOS.OUT_OF_ORDER_DELAY_MIN_MS, CHAOS.OUT_OF_ORDER_DELAY_MAX_MS))
      : 0;

    // Chaos: corrupted JSON
    const isCorrupted = Math.random() < CHAOS.CORRUPT_CHANCE;
    const messageToSend = isCorrupted ? corruptJson(jsonPayload) : jsonPayload;

    // Chaos: duplicate messages
    const isDuplicate = Math.random() < CHAOS.DUPLICATE_CHANCE;
    const duplicateCount = isDuplicate
      ? Math.floor(randBetween(2, CHAOS.DUPLICATE_COUNT_MAX + 1))
      : 1;

    const sendMessage = () => {
      for (let i = 0; i < duplicateCount; i++) {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(messageToSend);
        }
      }
    };

    if (outOfOrderDelay > 0) {
      setTimeout(sendMessage, outOfOrderDelay);
    } else {
      sendMessage();
    }
  } catch (error) {
    handleError(ws, error);
  }
}

function corruptJson(json: string): string {
  const corruptionType = Math.floor(Math.random() * 4);
  switch (corruptionType) {
    case 0:
      // Truncate the message
      return json.slice(0, Math.floor(json.length * 0.7));
    case 1:
      // Remove closing brace
      return json.slice(0, -1);
    case 2:
      // Add garbage at the end
      return json + '}}garbage';
    case 3:
      // Remove a quote in the middle
      const quoteIndex = json.indexOf('"', 10);
      if (quoteIndex > 0) {
        return json.slice(0, quoteIndex) + json.slice(quoteIndex + 1);
      }
      return json.slice(0, -2);
    default:
      return json.slice(0, -1);
  }
}

function handleError(ws: WebSocket, error: unknown): void {
  const status = error instanceof HttpError ? error.status : 500;
  const message =
    error instanceof HttpError ? error.message : 'Unexpected error while fetching stock detail';
  ws.send(JSON.stringify({ type: 'error', status, message }));
}

function parseMessage(raw: RawData): ClientMessage | undefined {
  try {
    const parsed = JSON.parse(raw.toString());
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
      return parsed as ClientMessage;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function stopStream(subscription: Subscription): void {
  if (subscription.timer) {
    clearTimeout(subscription.timer);
    subscription.timer = undefined;
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}

function parseWsRequest(req: IncomingMessage): { pathname?: string; symbolFromQuery?: string } {
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `http://${host}`);
  const symbol = url.searchParams.get('symbol')?.trim().toUpperCase();
  return { pathname: url.pathname, symbolFromQuery: symbol || undefined };
}

function isAllowedPath(pathname: string): boolean {
  const normalized = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
  return normalized === '/ws' || normalized === '/ws/quotes';
}

function pickNextDelay(base: number): number {
  const jitter = randBetween(0.9, 1.1);
  const raw = base * jitter;
  return Math.min(10_000, Math.max(400, Math.round(raw)));
}

function randBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
