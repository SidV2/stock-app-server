export type StockRange = [number, number];

export interface StockHistoryPoint {
  timestamp: number;
  close: number;
  volume?: number;
}

export interface StockInsightDto {
  label: string;
  value: string;
  delta?: number;
  deltaDirection?: 'up' | 'down';
}

export interface StockNewsItemDto {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  excerpt: string;
}

export interface StockDetailDto {
  symbol: string;
  company: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number;
  dayRange: StockRange;
  week52Range: StockRange;
  marketCap: number;
  volume: number;
  avgVolume: number;
  peRatio: number;
  dividendYield?: number;
  beta?: number;
  description: string;
  summary: string;
  insights: StockInsightDto[];
  news: StockNewsItemDto[];
  history: number[];
  historyIntervalMinutes: number;
  updatedAt: number;
}
