import { Router } from 'express';
import { getStockHistory } from '../services/stock-history.service';

const router = Router();

type Range = '1d' | '5d' | '1m' | '6m' | '1y' | '5y';
const allowedRanges: Range[] = ['1d', '5d', '1m', '6m', '1y', '5y'];

router.get('/:symbol/:range', async (req, res, next) => {
  try {
    const { symbol, range } = req.params;

    if (!allowedRanges.includes(range as Range)) {
      return res.status(400).json({ message: 'Invalid range' });
    }

    const detail = await getStockHistory(symbol, range as Range);
    res.json(detail);
  } catch (error) {
    next(error);
  }
});

export default router;
