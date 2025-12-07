import { TopPickDto } from '../models';
import { getSimulatedTopPicks } from './market-simulator';
import { applyMockDelay } from '../utils/mock-delay';

export async function getTopPicks(): Promise<TopPickDto[]> {
  await applyMockDelay();
  return getSimulatedTopPicks();
}
