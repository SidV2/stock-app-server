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

// Seeded random function for consistent historical data
function seededRandom(symbol: string, index: number): number {
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed += symbol.charCodeAt(i);
  }
  const x = Math.sin(seed + index * 137.508) * 10000;
  return x - Math.floor(x);
}

// Get a consistent base price for each symbol
function getBasePrice(symbol: string): number {
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed += symbol.charCodeAt(i);
  }
  // Generate a base price between 50 and 500
  const normalized = Math.abs(Math.sin(seed * 12.9898)) * 43758.5453;
  return 50 + (normalized - Math.floor(normalized)) * 450;
}

export async function getStockHistory(symbol: string, range: Range): Promise<StockDetailDto> {
  await applyMockDelay();

  // Get live/current stock detail (price changes dynamically for metadata)
  const stockDetail = await getSimulatedStockDetail(symbol, {});
  const days = getDays(range);
  
  // Use a fixed base price for consistent historical data
  const basePrice = getBasePrice(symbol);
  const history = [];
  let price = basePrice;
  
  // Generate consistent historical data forward from base price
  for (let i = 0; i < days; i++) {
    const random = seededRandom(symbol, i);
    const change = (random * 2 - 1) * 0.8; // Price variation
    price += change;
    history.push(Number(price.toFixed(2)));
  }

  return {
    ...stockDetail,
    history,
  };
}
