import { StockDetailDto } from '../models/stock-detail';
import {
  getSimulatedStockDetail,
  listSimulatedStocks,
  ListStocksOptions,
  StockListResponseDto
} from './market-simulator';

export interface StockDetailOptions {
  intervalMinutes?: number;
}

export function getStockDetail(symbol: string, options: StockDetailOptions = {}): Promise<StockDetailDto> {
  return Promise.resolve(getSimulatedStockDetail(symbol, options));
}

export function listStocks(options: ListStocksOptions): Promise<StockListResponseDto> {
  return Promise.resolve(listSimulatedStocks(options));
}

export type { ListStocksOptions, StockListResponseDto };
