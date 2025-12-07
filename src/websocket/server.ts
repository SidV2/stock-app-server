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

type StockDetailMessage = {
  type: 'stockDetail';
  symbol: string;
  data: StockDetailDto;
  updatedAt: number;
  delayedByMs: number;
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
      const nextDelay = pickNextDelay(sub.intervalMs);
      sub.timer = setTimeout(() => {
        if (closed) return;
        scheduleNext(ws, sub);
        void pushUpdate(ws, sub.symbol, 0);
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

async function pushUpdate(ws: WebSocket, symbol: string, sendDelayMs = 0): Promise<void> {
  try {
    const detail = await getStockDetail(symbol);
    const complete: StockDetailDto = {
      ...detail,
      insights: detail.insights ?? [],
      news: detail.news ?? [],
      history: detail.history ?? [],
      historyIntervalMinutes: detail.historyIntervalMinutes ?? 1,
      updatedAt: detail.updatedAt ?? Date.now()
    };
    const payload: StockDetailMessage = {
      type: 'stockDetail',
      symbol,
      data: complete,
      updatedAt: complete.updatedAt,
      delayedByMs: sendDelayMs
    };
    if (sendDelayMs > 0) {
      setTimeout(() => ws.send(JSON.stringify(payload)), sendDelayMs);
    } else {
      ws.send(JSON.stringify(payload));
    }
  } catch (error) {
    handleError(ws, error);
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
