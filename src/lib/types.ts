// Types for the simulation engine.

export interface SimulationInputs {
  childAge: number;                  // 0–17
  currentBalance: number;            // dollars
  monthlyContributions: number[];    // length = horizon in months; index 0 = first month
  todayTuitionTarget: number;        // today's dollars

  // Investment vehicle
  useGlidepath: boolean;
  customEquityFraction?: number;     // 0–1, used when useGlidepath = false

  // Assumption overrides (optional — defaults come from constants.ts)
  equityMeanAnnual?: number;
  equityStdDevAnnual?: number;
  fixedIncomeMeanAnnual?: number;
  fixedIncomeStdDevAnnual?: number;
  tuitionInflationMeanAnnual?: number;
  tuitionInflationStdDevAnnual?: number;
  equityFiCorrelation?: number;

  simulationCount?: number;
}

export interface PercentilePath {
  label: string;       // e.g. "p10", "p25", "p50", "p75", "p90"
  values: number[];    // portfolio value at each month (length = horizonMonths + 1, includes month 0)
}

export interface YearlySnapshot {
  year: number;                    // 1-indexed projection year
  childAgeAtStart: number;         // child's age (fractional) at start of this year
  months: number;                  // 12 for full years; < 12 for a partial final year
  startValue: number;
  endValue: number;
  annualContribution: number;      // sum of monthly contributions this year
  equityReturnAnnual: number;      // realized: compound of monthly draws; annualized if partial year
  fiReturnAnnual: number;
  portfolioReturnAnnual: number;   // blended, using midpoint-year glidepath allocation
  tuitionInflationAnnual: number;
}

export interface RepresentativePath {
  label: string;        // 'p10' | 'p25' | 'p50' | 'p75' | 'p90' | 'deterministic'
  description: string;  // human-readable note
  snapshots: YearlySnapshot[];
}

export interface SimulationDiagnostics {
  // Realized annual statistics across all sim-months (annualized from monthly draws)
  equityMeanRealized: number;
  equityStdDevRealized: number;
  fiMeanRealized: number;
  fiStdDevRealized: number;
  inflationMeanRealized: number;
  inflationStdDevRealized: number;
  equityFiCorrelationRealized: number;
  // Count of monthly draws used
  totalMonthlyDraws: number;
}

export interface SimulationResults {
  probabilityOfSuccess: number;          // 0–1
  terminalValues: number[];              // one value per simulation
  percentilePaths: PercentilePath[];     // p10, p25, p50, p75, p90
  deterministicPath: number[];           // uses mean returns, mean inflation
  medianNominalTarget: number;           // median terminal nominal tuition target
  horizonMonths: number;
  representativePaths: RepresentativePath[]; // p10…p90 + deterministic, for scenario table
  diagnostics: SimulationDiagnostics;
}
