import { TopPickDto } from '../models';
import { getSimulatedTopPicks } from './market-simulator';

export function getTopPicks(): Promise<TopPickDto[]> {
  return Promise.resolve(getSimulatedTopPicks());
}
