import { Router } from 'express';
import { getTopPicks } from '../services/top-picks.service';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const picks = await getTopPicks();
    res.json(picks);
  } catch (error) {
    next(error);
  }
});

export default router;
