import { StockDetailDto } from '../models/stock-detail';
import { TopPickDto } from '../models/top-picks';
import { HttpError } from '../utils/http-error';
import { StockDetailOptions } from './stock-detail.service';

const DEFAULT_UNIVERSE_SIZE = clampNumber(Number(process.env.MOCK_STOCK_COUNT), 200, 2000, 500);
const HISTORY_LENGTH = clampNumber(Number(process.env.MOCK_HISTORY_LENGTH), 60, 960, 240);
const DAY_WINDOW = clampNumber(Number(process.env.MOCK_INTRADAY_POINTS), 30, HISTORY_LENGTH, 78);
const TOP_PICKS_COUNT = clampNumber(Number(process.env.MOCK_TOP_PICKS_COUNT), 3, 12, 4);
const DAY_DURATION_MS = 1000 * 60 * 60 * 6.5; // approx. trading day length
const BASE_HISTORY_INTERVAL_MINUTES = 1;

type StockProfile = {
  symbol: string;
  company: string;
  sector: string;
  industry: string;
  country: string;
};

type StockState = {
  profile: StockProfile;
  summary: string;
  description: string;
  volatility: number;
  drift: number;
  sharesOutstanding: number;
  price: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  week52High: number;
  week52Low: number;
  history: number[];
  volume: number;
  avgVolume: number;
  peRatio: number;
  dividendYield: number;
  beta: number;
  updatedAt: number;
  dayStart: number;
  marketCap: number;
};

const KNOWN_PROFILES: StockProfile[] = [
  { symbol: 'AAPL', company: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', country: 'United States' },
  { symbol: 'MSFT', company: 'Microsoft Corp.', sector: 'Technology', industry: 'Software—Infrastructure', country: 'United States' },
  { symbol: 'GOOGL', company: 'Alphabet Inc. (Class A)', sector: 'Communication Services', industry: 'Internet Content & Information', country: 'United States' },
  { symbol: 'AMZN', company: 'Amazon.com Inc.', sector: 'Consumer Cyclical', industry: 'Internet Retail', country: 'United States' },
  { symbol: 'NVDA', company: 'NVIDIA Corp.', sector: 'Technology', industry: 'Semiconductors', country: 'United States' },
  { symbol: 'META', company: 'Meta Platforms Inc.', sector: 'Communication Services', industry: 'Internet Content & Information', country: 'United States' },
  { symbol: 'TSLA', company: 'Tesla Inc.', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', country: 'United States' },
  { symbol: 'NFLX', company: 'Netflix Inc.', sector: 'Communication Services', industry: 'Entertainment', country: 'United States' },
  { symbol: 'ADBE', company: 'Adobe Inc.', sector: 'Technology', industry: 'Software—Infrastructure', country: 'United States' },
  { symbol: 'ORCL', company: 'Oracle Corp.', sector: 'Technology', industry: 'Software—Infrastructure', country: 'United States' },
  { symbol: 'CRM', company: 'Salesforce Inc.', sector: 'Technology', industry: 'Software—Application', country: 'United States' },
  { symbol: 'INTC', company: 'Intel Corp.', sector: 'Technology', industry: 'Semiconductors', country: 'United States' },
  { symbol: 'AMD', company: 'Advanced Micro Devices', sector: 'Technology', industry: 'Semiconductors', country: 'United States' },
  { symbol: 'AVGO', company: 'Broadcom Inc.', sector: 'Technology', industry: 'Semiconductors', country: 'United States' },
  { symbol: 'IBM', company: 'International Business Machines', sector: 'Technology', industry: 'Information Technology Services', country: 'United States' },
  { symbol: 'QCOM', company: 'Qualcomm Inc.', sector: 'Technology', industry: 'Semiconductors', country: 'United States' },
  { symbol: 'UBER', company: 'Uber Technologies Inc.', sector: 'Technology', industry: 'Software—Application', country: 'United States' },
  { symbol: 'LYFT', company: 'Lyft Inc.', sector: 'Technology', industry: 'Software—Application', country: 'United States' },
  { symbol: 'SHOP', company: 'Shopify Inc.', sector: 'Technology', industry: 'Software—Application', country: 'Canada' },
  { symbol: 'SQ', company: 'Block Inc.', sector: 'Technology', industry: 'Software—Infrastructure', country: 'United States' },
  { symbol: 'PYPL', company: 'PayPal Holdings Inc.', sector: 'Financial Services', industry: 'Credit Services', country: 'United States' },
  { symbol: 'MA', company: 'Mastercard Inc.', sector: 'Financial Services', industry: 'Credit Services', country: 'United States' },
  { symbol: 'V', company: 'Visa Inc.', sector: 'Financial Services', industry: 'Credit Services', country: 'United States' },
  { symbol: 'JPM', company: 'JPMorgan Chase & Co.', sector: 'Financial Services', industry: 'Banks—Diversified', country: 'United States' },
  { symbol: 'BAC', company: 'Bank of America Corp.', sector: 'Financial Services', industry: 'Banks—Diversified', country: 'United States' },
  { symbol: 'WFC', company: 'Wells Fargo & Co.', sector: 'Financial Services', industry: 'Banks—Diversified', country: 'United States' },
  { symbol: 'GS', company: 'Goldman Sachs Group Inc.', sector: 'Financial Services', industry: 'Capital Markets', country: 'United States' },
  { symbol: 'MS', company: 'Morgan Stanley', sector: 'Financial Services', industry: 'Capital Markets', country: 'United States' },
  { symbol: 'C', company: 'Citigroup Inc.', sector: 'Financial Services', industry: 'Banks—Diversified', country: 'United States' },
  { symbol: 'KO', company: 'Coca-Cola Co.', sector: 'Consumer Defensive', industry: 'Beverages—Non-Alcoholic', country: 'United States' },
  { symbol: 'PEP', company: 'PepsiCo Inc.', sector: 'Consumer Defensive', industry: 'Beverages—Non-Alcoholic', country: 'United States' },
  { symbol: 'PG', company: 'Procter & Gamble Co.', sector: 'Consumer Defensive', industry: 'Household & Personal Products', country: 'United States' },
  { symbol: 'JNJ', company: 'Johnson & Johnson', sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'United States' },
  { symbol: 'PFE', company: 'Pfizer Inc.', sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'United States' },
  { symbol: 'MRK', company: 'Merck & Co. Inc.', sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'United States' },
  { symbol: 'ABBV', company: 'AbbVie Inc.', sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'United States' },
  { symbol: 'LLY', company: 'Eli Lilly and Co.', sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'United States' },
  { symbol: 'UNH', company: 'UnitedHealth Group Inc.', sector: 'Healthcare', industry: 'Healthcare Plans', country: 'United States' },
  { symbol: 'CVS', company: 'CVS Health Corp.', sector: 'Healthcare', industry: 'Healthcare Plans', country: 'United States' },
  { symbol: 'XOM', company: 'Exxon Mobil Corp.', sector: 'Energy', industry: 'Oil & Gas Integrated', country: 'United States' },
  { symbol: 'CVX', company: 'Chevron Corp.', sector: 'Energy', industry: 'Oil & Gas Integrated', country: 'United States' },
  { symbol: 'COP', company: 'ConocoPhillips', sector: 'Energy', industry: 'Oil & Gas E&P', country: 'United States' },
  { symbol: 'BP', company: 'BP plc', sector: 'Energy', industry: 'Oil & Gas Integrated', country: 'United Kingdom' },
  { symbol: 'SHEL', company: 'Shell plc', sector: 'Energy', industry: 'Oil & Gas Integrated', country: 'Netherlands' },
  { symbol: 'RIO', company: 'Rio Tinto Group', sector: 'Basic Materials', industry: 'Other Industrial Metals & Mining', country: 'United Kingdom' },
  { symbol: 'BHP', company: 'BHP Group Ltd.', sector: 'Basic Materials', industry: 'Other Industrial Metals & Mining', country: 'Australia' },
  { symbol: 'CAT', company: 'Caterpillar Inc.', sector: 'Industrials', industry: 'Farm & Heavy Construction Machinery', country: 'United States' },
  { symbol: 'BA', company: 'Boeing Co.', sector: 'Industrials', industry: 'Aerospace & Defense', country: 'United States' },
  { symbol: 'LMT', company: 'Lockheed Martin Corp.', sector: 'Industrials', industry: 'Aerospace & Defense', country: 'United States' },
  { symbol: 'NOC', company: 'Northrop Grumman Corp.', sector: 'Industrials', industry: 'Aerospace & Defense', country: 'United States' },
  { symbol: 'GE', company: 'General Electric Co.', sector: 'Industrials', industry: 'Specialty Industrial Machinery', country: 'United States' },
  { symbol: 'DE', company: 'Deere & Co.', sector: 'Industrials', industry: 'Farm & Heavy Construction Machinery', country: 'United States' },
  { symbol: 'T', company: 'AT&T Inc.', sector: 'Communication Services', industry: 'Telecom Services', country: 'United States' },
  { symbol: 'VZ', company: 'Verizon Communications Inc.', sector: 'Communication Services', industry: 'Telecom Services', country: 'United States' }
];

export interface StockListItemDto {
  symbol: string;
  company: string;
  sector: string;
  industry: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  volume: number;
  beta: number;
}

export interface StockListResponseDto {
  total: number;
  items: StockListItemDto[];
}

export interface ListStocksOptions {
  search?: string;
  offset?: number;
  limit?: number;
}

const universe = new Map<string, StockState>();

const SYNTHETIC_SECTORS = [
  {
    sector: 'Technology',
    industries: ['Cloud Infrastructure', 'Applied AI', 'Developer Platforms', 'Cybersecurity'],
    tickerPrefix: 'QT',
    adjectives: ['Quantum', 'Apex', 'Vector', 'Nimbus', 'Vertex', 'Pulse', 'Helix'],
    nouns: ['Systems', 'Dynamics', 'Networks', 'Solutions', 'Analytics', 'Platforms']
  },
  {
    sector: 'Healthcare',
    industries: ['Digital Health', 'Biotech Tools', 'Medical Devices', 'Clinical Analytics'],
    tickerPrefix: 'HC',
    adjectives: ['Nova', 'Synapse', 'Pulse', 'Verve', 'Aria', 'Vital'],
    nouns: ['Bio', 'Therapeutics', 'Health', 'Medica', 'Genomics', 'Labs']
  },
  {
    sector: 'Financial Services',
    industries: ['Fintech', 'Payments', 'Digital Banking', 'Wealth Platforms'],
    tickerPrefix: 'FS',
    adjectives: ['Summit', 'Atlas', 'Crest', 'Horizon', 'Cobalt', 'Sterling'],
    nouns: ['Capital', 'Finance', 'Holdings', 'Markets', 'Funds', 'Partners']
  },
  {
    sector: 'Energy',
    industries: ['Renewables', 'Grid Storage', 'Hydrogen', 'Energy Services'],
    tickerPrefix: 'EN',
    adjectives: ['Bright', 'Element', 'Flux', 'Aurora', 'Terra', 'Ion'],
    nouns: ['Energy', 'Power', 'Resources', 'Dynamics', 'Solutions', 'Transition']
  },
  {
    sector: 'Industrials',
    industries: ['Automation', 'Logistics', 'Advanced Manufacturing', 'Robotics'],
    tickerPrefix: 'IN',
    adjectives: ['Prime', 'Magna', 'Vector', 'Titan', 'Optic', 'Modus'],
    nouns: ['Logistics', 'Automation', 'Manufacturing', 'Industries', 'Robotics']
  }
];

initializeUniverse();

export function getSimulatedStockDetail(symbol: string, options: StockDetailOptions = {}): StockDetailDto {
  const state = findState(symbol);
  advanceState(state);
  return mapToDetail(state, options);
}

export function listSimulatedStocks(options: ListStocksOptions = {}): StockListResponseDto {
  tickUniverse(Math.min(50, universe.size));

  const searchTerm = options.search?.trim().toLowerCase();
  const filtered = searchTerm
    ? Array.from(universe.values()).filter((state) =>
        state.profile.symbol.toLowerCase().includes(searchTerm) ||
        state.profile.company.toLowerCase().includes(searchTerm) ||
        state.profile.sector.toLowerCase().includes(searchTerm)
      )
    : Array.from(universe.values());

  const total = filtered.length;
  const offset = clampNumber(options.offset, 0, total, 0);
  const limit = clampNumber(options.limit, 1, 500, 50);
  const slice = filtered.slice(offset, offset + limit);

  const items = slice.map(toListItem);

  return { total, items };
}

export function getSimulatedTopPicks(count = TOP_PICKS_COUNT): TopPickDto[] {
  tickUniverse(Math.min(25, universe.size));

  const ranked = Array.from(universe.values())
    .map((state) => ({
      state,
      momentum: getMomentum(state)
    }))
    .sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum))
    .slice(0, clampNumber(count, 1, 20, TOP_PICKS_COUNT));

  return ranked.map(({ state, momentum }) => ({
    symbol: state.profile.symbol,
    company: state.profile.company,
    riskLevel: classifyRisk(state.volatility),
    summary: state.summary,
    sparkline: state.history.slice(-10),
    trend: momentum >= 0 ? 'up' : 'down'
  }));
}

export function getAvailableSymbols(): string[] {
  return Array.from(universe.keys());
}

function initializeUniverse(): void {
  const baseProfiles = [...KNOWN_PROFILES];
  const remaining = Math.max(0, DEFAULT_UNIVERSE_SIZE - baseProfiles.length);
  if (remaining > 0) {
    baseProfiles.push(...generateSyntheticProfiles(remaining));
  }

  for (const profile of baseProfiles) {
    const state = createState(profile);
    universe.set(profile.symbol, state);
  }
}

function createState(profile: StockProfile): StockState {
  const volatility = randBetween(0.004, 0.03);
  const drift = randBetween(-0.0003, 0.0006);
  const sharesOutstanding = randBetween(0.5e9, 6e9);
  const basePrice = randBetween(8, 900);
  const history = generateHistory(basePrice, volatility, HISTORY_LENGTH);
  const price = history[history.length - 1];
  const previousClose = history[Math.max(0, history.length - 2)];
  const daySlice = history.slice(-DAY_WINDOW);
  const dayHigh = daySlice.length ? Math.max(...daySlice) : price;
  const dayLow = daySlice.length ? Math.min(...daySlice) : price;
  const open = daySlice[0] ?? price;
  const avgVolume = randBetween(3e6, 120e6);
  const volume = avgVolume * randBetween(0.7, 1.3);
  const summary = `${profile.company} drives ${profile.industry.toLowerCase()} innovation across the ${profile.sector.toLowerCase()} sector.`;
  const description = `${profile.company} operates in ${profile.country}, building ${profile.industry.toLowerCase()} solutions with a focus on automation, data platforms, and AI-assisted tooling.`;

  return {
    profile,
    summary,
    description,
    volatility,
    drift,
    sharesOutstanding,
    price,
    previousClose,
    open,
    dayHigh,
    dayLow,
    week52High: Number((price * randBetween(1.15, 1.65)).toFixed(2)),
    week52Low: Number((price * randBetween(0.45, 0.85)).toFixed(2)),
    history,
    volume,
    avgVolume,
    peRatio: randBetween(6, 55),
    dividendYield: Math.random() < 0.45 ? randBetween(0.005, 0.045) : 0,
    beta: randBetween(0.6, 1.8),
    updatedAt: Date.now() - Math.floor(Math.random() * 10_000),
    dayStart: Date.now() - Math.floor(Math.random() * DAY_DURATION_MS),
    marketCap: price * sharesOutstanding
  };
}

function generateHistory(basePrice: number, volatility: number, length: number): number[] {
  const history: number[] = [];
  let current = basePrice * randBetween(0.92, 1.08);
  for (let i = 0; i < length; i++) {
    current = Math.max(1, current * (1 + randBetween(-volatility, volatility)));
    history.push(Number(current.toFixed(2)));
  }
  return history;
}

function advanceState(state: StockState): void {
  const now = Date.now();
  if (now - state.dayStart >= DAY_DURATION_MS) {
    state.dayStart = now;
    state.open = state.price;
    state.dayHigh = state.price;
    state.dayLow = state.price;
    state.previousClose = state.price;
  }

  const move = state.drift + randBetween(-state.volatility, state.volatility);
  const newPrice = Number(Math.max(1, state.price * (1 + move)).toFixed(2));

  state.previousClose = state.price;
  state.price = newPrice;
  state.marketCap = state.price * state.sharesOutstanding;
  state.dayHigh = Math.max(state.dayHigh, newPrice);
  state.dayLow = Math.min(state.dayLow, newPrice);
  state.week52High = Math.max(state.week52High, newPrice);
  state.week52Low = Math.min(state.week52Low, newPrice);

  state.history.push(newPrice);
  if (state.history.length > HISTORY_LENGTH) {
    state.history.splice(0, state.history.length - HISTORY_LENGTH);
  }

  state.volume = Math.round(state.avgVolume * randBetween(0.7, 1.3));
  state.avgVolume = Math.round(state.avgVolume * 0.9 + state.volume * 0.1);

  state.updatedAt = now;
}

function mapToDetail(state: StockState, options: StockDetailOptions): StockDetailDto {
  const change = Number((state.price - state.previousClose).toFixed(2));
  const changePercent = state.previousClose
    ? Number(((change / state.previousClose) * 100).toFixed(2))
    : 0;

  const requestedInterval = options.intervalMinutes ?? BASE_HISTORY_INTERVAL_MINUTES;
  const intervalMinutes = Math.max(BASE_HISTORY_INTERVAL_MINUTES, Math.floor(requestedInterval));
  const history = sampleHistory(state.history, intervalMinutes);

  return {
    symbol: state.profile.symbol,
    company: state.profile.company,
    price: state.price,
    change,
    changePercent,
    previousClose: state.previousClose,
    open: state.open,
    dayRange: [Number(state.dayLow.toFixed(2)), Number(state.dayHigh.toFixed(2))],
    week52Range: [Number(state.week52Low.toFixed(2)), Number(state.week52High.toFixed(2))],
    marketCap: Math.round(state.marketCap),
    volume: Math.round(state.volume),
    avgVolume: Math.round(state.avgVolume),
    peRatio: Number(state.peRatio.toFixed(2)),
    dividendYield: state.dividendYield ? Number(state.dividendYield.toFixed(4)) : undefined,
    beta: Number(state.beta.toFixed(2)),
    description: state.description,
    summary: state.summary,
    insights: buildInsights(state.marketCap, state.peRatio, state.dividendYield ?? 0, changePercent),
    news: [],
    history,
    historyIntervalMinutes: intervalMinutes,
    updatedAt: state.updatedAt
  };
}

function sampleHistory(values: number[], intervalMinutes: number): number[] {
  if (!values.length) {
    return [];
  }
  const step = Math.max(1, Math.round(intervalMinutes / BASE_HISTORY_INTERVAL_MINUTES));
  if (step === 1) {
    return [...values];
  }
  const sampled: number[] = [];
  for (let i = 0; i < values.length; i += step) {
    sampled.push(values[i]);
  }
  const last = values[values.length - 1];
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }
  return sampled;
}

function toListItem(state: StockState): StockListItemDto {
  const change = Number((state.price - state.previousClose).toFixed(2));
  const changePercent = state.previousClose
    ? Number(((change / state.previousClose) * 100).toFixed(2))
    : 0;

  return {
    symbol: state.profile.symbol,
    company: state.profile.company,
    sector: state.profile.sector,
    industry: state.profile.industry,
    price: state.price,
    change,
    changePercent,
    marketCap: Math.round(state.marketCap),
    volume: Math.round(state.volume),
    beta: Number(state.beta.toFixed(2))
  };
}

function getMomentum(state: StockState): number {
  const sample = state.history.slice(-10);
  if (sample.length < 2) {
    return 0;
  }
  return sample[sample.length - 1] - sample[0];
}

function tickUniverse(sampleSize: number): void {
  if (!sampleSize) return;
  const states = Array.from(universe.values());
  for (let i = 0; i < sampleSize; i++) {
    const state = states[Math.floor(Math.random() * states.length)];
    advanceState(state);
  }
}

function findState(symbol: string): StockState {
  const key = symbol.trim().toUpperCase();
  if (!key) {
    throw new HttpError(400, 'Symbol is required');
  }
  const state = universe.get(key);
  if (!state) {
    throw new HttpError(404, `Symbol ${key} is not available in the mock universe`);
  }
  return state;
}

function classifyRisk(volatility: number): TopPickDto['riskLevel'] {
  if (volatility < 0.01) return 'Low';
  if (volatility < 0.02) return 'Medium';
  return 'High';
}

function buildInsights(
  marketCap: number,
  peRatio: number,
  dividendYield: number,
  changePercent: number
): { label: string; value: string; delta?: number; deltaDirection?: 'up' | 'down' }[] {
  return [
    {
      label: 'Market Cap',
      value: formatCompactNumber(marketCap)
    },
    {
      label: 'P/E Ratio',
      value: peRatio ? peRatio.toFixed(2) : '—'
    },
    {
      label: 'Dividend Yield',
      value: dividendYield ? `${(dividendYield * 100).toFixed(2)}%` : '—'
    },
    {
      label: '1D Move',
      value: `${changePercent.toFixed(2)}%`,
      delta: changePercent,
      deltaDirection: changePercent >= 0 ? 'up' : 'down'
    }
  ];
}

function formatCompactNumber(value: number): string {
  if (!value) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value as number, min), max);
}

function randBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}


function generateSyntheticProfiles(count: number): StockProfile[] {
  const generated: StockProfile[] = [];
  let tickerCounter = 0;

  while (generated.length < count) {
    const sector = SYNTHETIC_SECTORS[tickerCounter % SYNTHETIC_SECTORS.length];
    const adjective = sector.adjectives[tickerCounter % sector.adjectives.length];
    const noun = sector.nouns[(tickerCounter >> 1) % sector.nouns.length];
    const industry = sector.industries[(tickerCounter >> 2) % sector.industries.length];
    const symbol = `${sector.tickerPrefix}${String(tickerCounter).padStart(3, '0')}`;

    generated.push({
      symbol,
      company: `${adjective} ${noun}`,
      sector: sector.sector,
      industry,
      country: 'United States'
    });

    tickerCounter++;
  }

  return generated;
}


