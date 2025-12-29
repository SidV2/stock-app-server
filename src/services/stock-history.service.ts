import { StockDetailDto } from '../models/stock-detail';
import { getSimulatedStockDetail } from './market-simulator';
import { applyMockDelay } from '../utils/mock-delay';

type Range = '1d' | '5d' | '1m' | '6m' | '1y' | '5y';

function getDays(range: Range): number {
  switch (range) {
    case '1d':
      return 1;
    case '5d':
      return 5;
    case '1m':
      return 30;
    case '6m':
      return 180;
    case '1y':
      return 365;
    case '5y':
      return 365 * 5;
    default:
      return 1;
  }
}

export async function getStockHistory(symbol: string, range: Range): Promise<StockDetailDto> {
  await applyMockDelay();

  const stockDetail = await getSimulatedStockDetail(symbol, {});
  const days = getDays(range);
  const history = [];
  let price = stockDetail.price;
  for (let i = 0; i < days; i++) {
    price += Math.random() * 2 - 1;
    history.push(price);
  }

  return {
    ...stockDetail,
    history,
  };
}
