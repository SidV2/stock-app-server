import { StockDetailDto } from '../models/stock-detail';
import {
  getSimulatedStockDetail,
  listSimulatedStocks,
  ListStocksOptions,
  StockListResponseDto
} from './market-simulator';
import { applyMockDelay } from '../utils/mock-delay';

export interface StockDetailOptions {
  intervalMinutes?: number;
}

export async function getStockDetail(symbol: string, options: StockDetailOptions = {}): Promise<StockDetailDto> {
  await applyMockDelay();
  return getSimulatedStockDetail(symbol, options);
}

export async function listStocks(options: ListStocksOptions): Promise<StockListResponseDto> {
  await applyMockDelay();
  return listSimulatedStocks(options);
}

export type { ListStocksOptions, StockListResponseDto };
