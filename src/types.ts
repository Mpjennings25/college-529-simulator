import {
  EQUITY_MEAN_ANNUAL, EQUITY_STDDEV_ANNUAL,
  FIXED_INCOME_MEAN_ANNUAL, FIXED_INCOME_STDDEV_ANNUAL,
  TUITION_INFLATION_MEAN_ANNUAL, TUITION_INFLATION_STDDEV_ANNUAL,
  EQUITY_FI_CORRELATION,
} from './lib/constants';

export type TargetKey = 'instate' | 'outofstate' | 'private' | 'custom';
export type IncreaseRule = 'none' | 'pct_per_year' | 'dollar_per_year' | 'one_time';

export interface AppInputState {
  childAge: number;         // whole years, 0–17
  childAgeMonths: number;   // additional months, 0–11
  currentBalance: number;
  // Level 1
  baseMonthly: number;
  // Level 2
  increaseRule: IncreaseRule;
  increasePct: number;
  increaseDollar: number;
  oneTimeYear: number;
  oneTimeAmount: number;
  // Level 3
  showGrid: boolean;
  gridValues: number[]; // one per projection year, length = 18 - childAge
  // Target
  targetKey: TargetKey;
  customTargetValue: number;
  // Investment vehicle
  useGlidepath: boolean;
  customEquityFraction: number;
  // Advanced assumptions
  equityMean: number;
  equityStdDev: number;
  fiMean: number;
  fiStdDev: number;
  inflationMean: number;
  inflationStdDev: number;
  rho: number;
}

export const BENCHMARKS: Record<Exclude<TargetKey, 'custom'>, { label: string; today: number }> = {
  instate:    { label: '4-Year In-State Public',     today: 110_000 },
  outofstate: { label: '4-Year Out-of-State Public', today: 180_000 },
  private:    { label: '4-Year Private',             today: 240_000 },
};

export function getTargetToday(state: AppInputState): number {
  if (state.targetKey === 'custom') return Math.max(0, state.customTargetValue);
  return BENCHMARKS[state.targetKey].today;
}

export function buildGridFromRules(state: AppInputState): number[] {
  const years = Math.max(0, 18 - state.childAge);
  return Array.from({ length: years }, (_, y) => {
    switch (state.increaseRule) {
      case 'pct_per_year':
        return Math.round(state.baseMonthly * Math.pow(1 + state.increasePct / 100, y));
      case 'dollar_per_year':
        return Math.max(0, Math.round(state.baseMonthly + y * state.increaseDollar));
      case 'one_time':
        return y + 1 >= state.oneTimeYear
          ? state.baseMonthly + state.oneTimeAmount
          : state.baseMonthly;
      default:
        return state.baseMonthly;
    }
  });
}

export function buildMonthlyContributions(state: AppInputState): number[] {
  const years = Math.max(0, 18 - state.childAge);
  const monthly: number[] = [];

  if (state.showGrid) {
    for (let y = 0; y < years; y++) {
      const amount = Math.max(0, state.gridValues[y] ?? 0);
      for (let m = 0; m < 12; m++) monthly.push(amount);
    }
    return monthly;
  }

  for (let y = 0; y < years; y++) {
    let amount: number;
    switch (state.increaseRule) {
      case 'pct_per_year':
        amount = state.baseMonthly * Math.pow(1 + state.increasePct / 100, y);
        break;
      case 'dollar_per_year':
        amount = state.baseMonthly + y * state.increaseDollar;
        break;
      case 'one_time':
        amount = y + 1 >= state.oneTimeYear
          ? state.baseMonthly + state.oneTimeAmount
          : state.baseMonthly;
        break;
      default:
        amount = state.baseMonthly;
    }
    for (let m = 0; m < 12; m++) monthly.push(Math.max(0, amount));
  }
  return monthly;
}

// Keys whose changes should trigger grid regeneration
export const RULE_KEYS: ReadonlyArray<keyof AppInputState> = [
  'baseMonthly', 'increaseRule', 'increasePct',
  'increaseDollar', 'oneTimeYear', 'oneTimeAmount',
];

export const INITIAL_STATE: AppInputState = {
  childAge: 0,
  childAgeMonths: 0,
  currentBalance: 10_000,
  baseMonthly: 500,
  increaseRule: 'none',
  increasePct: 3,
  increaseDollar: 25,
  oneTimeYear: 3,
  oneTimeAmount: 200,
  showGrid: false,
  gridValues: [],
  targetKey: 'instate',
  customTargetValue: 100_000,
  useGlidepath: true,
  customEquityFraction: 0.7,
  equityMean: EQUITY_MEAN_ANNUAL,
  equityStdDev: EQUITY_STDDEV_ANNUAL,
  fiMean: FIXED_INCOME_MEAN_ANNUAL,
  fiStdDev: FIXED_INCOME_STDDEV_ANNUAL,
  inflationMean: TUITION_INFLATION_MEAN_ANNUAL,
  inflationStdDev: TUITION_INFLATION_STDDEV_ANNUAL,
  rho: EQUITY_FI_CORRELATION,
};
