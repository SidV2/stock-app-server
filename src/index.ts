import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { config } from 'dotenv';
import stockDetailRouter from './routes/stock-detail.route';
import stockHistoryRouter from './routes/stock-history.route';
import topPicksRouter from './routes/top-picks.route';
import { HttpError } from './utils/http-error';
import { attachWebSocketServer } from './websocket/server';

config();

const app = express();
const port = resolvePort(process.env.API_PORT, 4000);
const host = process.env.API_HOST || '127.0.0.1';
const allowedOrigins = (() => {
  const origins = (process.env.CORS_ALLOW_ORIGIN ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length ? origins : ['*'];
})();
const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const allowedHeaders = ['Content-Type', 'Authorization'];

app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin ?? '';
  const allowAll = allowedOrigins.includes('*');
  const matchedOrigin = allowAll ? '*' : allowedOrigins.find((allowed) => allowed === origin);

  if (matchedOrigin) {
    res.header('Access-Control-Allow-Origin', matchedOrigin);
    if (!allowAll) {
      res.header('Vary', 'Origin');
    }
  }
  res.header('Access-Control-Allow-Methods', allowedMethods.join(','));
  res.header('Access-Control-Allow-Headers', allowedHeaders.join(','));

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/stocks', stockDetailRouter);
app.use('/api/stock-history', stockHistoryRouter);
app.use('/api/top-picks', topPicksRouter);

app.use((_req, _res, next) => {
  next(new HttpError(404, 'Not Found'));
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message =
    err instanceof HttpError
      ? err.message
      : 'Unexpected server error';

  console.error('[api]', err);
  res.status(status).json({ message });
});

const server = createServer(app);
attachWebSocketServer(server);

server.listen(port, host, () => {
  console.log(`[api] Stock detail server listening on http://${host}:${port}`);
});

function resolvePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
