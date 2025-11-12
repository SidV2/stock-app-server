export type TopPickTrend = 'up' | 'down';
export type TopPickRisk = 'Low' | 'Medium' | 'High';

export interface TopPickDto {
  symbol: string;
  company: string;
  riskLevel: TopPickRisk;
  summary: string;
  sparkline: number[];
  trend: TopPickTrend;
}
