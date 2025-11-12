import { Router } from 'express';
import { getStockDetail, listStocks } from '../services/stock-detail.service';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { q, limit, offset } = req.query;
    const result = await listStocks({
      search: typeof q === 'string' ? q : undefined,
      limit: typeof limit === 'string' ? Number(limit) : undefined,
      offset: typeof offset === 'string' ? Number(offset) : undefined
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:symbol/detail', async (req, res, next) => {
  try {
    const interval = parseInterval(req.query.interval);
    const detail = await getStockDetail(req.params.symbol, {
      intervalMinutes: interval
    });
    res.json(detail);
  } catch (error) {
    next(error);
  }
});

export default router;

function parseInterval(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const match = value.trim().toLowerCase().match(/^(\d+)([mh])?$/);
  if (!match) {
    return undefined;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }
  const unit = match[2];
  const minutes = unit === 'h' ? amount * 60 : amount;
  return Math.min(Math.max(minutes, 1), 24 * 60);
}
