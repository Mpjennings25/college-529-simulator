// All magic numbers for the simulation engine live here.
// Adjust these to change default assumptions without touching simulation logic.

export const SIMULATION_COUNT = 5_000;

// --- Return assumptions (annual, nominal) ---
export const EQUITY_MEAN_ANNUAL = 0.10;
export const EQUITY_STDDEV_ANNUAL = 0.16;

export const FIXED_INCOME_MEAN_ANNUAL = 0.045;
export const FIXED_INCOME_STDDEV_ANNUAL = 0.06;

export const TUITION_INFLATION_MEAN_ANNUAL = 0.05;
export const TUITION_INFLATION_STDDEV_ANNUAL = 0.02;

// Equity / fixed income return correlation (ρ)
export const EQUITY_FI_CORRELATION = -0.15;

// --- Glidepath breakpoints ---
// Each entry: [childAgeAtPeriodStart, equityFraction]
// Allocation interpolates linearly between breakpoints.
export const GLIDEPATH_BREAKPOINTS: [number, number][] = [
  [0, 0.90],   // birth → age 10: 90% equity
  [10, 0.90],
  [15, 0.50],  // age 10–15: glide 90/10 → 50/50
  [18, 0.20],  // age 15–18: glide 50/50 → 20/80
];

// --- Benchmark college costs (today's dollars) ---
export const BENCHMARK_COSTS = {
  inStatePublic: 110_000,
  outOfStatePublic: 200_000,
  private: 280_000,
  graduateSchool: 150_000,
} as const;
