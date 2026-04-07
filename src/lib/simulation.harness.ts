/**
 * Console-runnable test harness for the simulation engine.
 *
 * Run with:
 *   npx tsx src/lib/simulation.harness.ts
 *
 * Validates:
 * - Probability of success
 * - Median, p10, p90 terminal values
 * - Deterministic path terminal value
 * - Glidepath equity allocations at key ages
 */

import { runSimulation, glidepathEquityFraction, choleskyDraw2x2 } from "./simulation";
import { BENCHMARK_COSTS } from "./constants";
import type { SimulationInputs } from "./types";

// ---------------------------------------------------------------------------
// Scenario: newborn, $0 balance, $500/mo flat, 4-year in-state target
// ---------------------------------------------------------------------------
function buildFlatContributions(horizonMonths: number, monthly: number): number[] {
  return new Array(horizonMonths).fill(monthly);
}

const childAge = 0;
const horizonMonths = (18 - childAge) * 12;

const inputs: SimulationInputs = {
  childAge,
  currentBalance: 0,
  monthlyContributions: buildFlatContributions(horizonMonths, 500),
  todayTuitionTarget: BENCHMARK_COSTS.inStatePublic,
  useGlidepath: true,
  simulationCount: 5_000,
};

console.log("=== 529 Simulation Engine Harness ===");
console.log(`Scenario: child age ${childAge}, $0 balance, $500/mo flat`);
console.log(`Target (today): $${inputs.todayTuitionTarget.toLocaleString()} (in-state public)`);
console.log(`Horizon: ${18 - childAge} years (${horizonMonths} months)`);
console.log(`Simulations: ${inputs.simulationCount?.toLocaleString()}`);
console.log("");

const t0 = performance.now();
const results = runSimulation(inputs);
const elapsed = performance.now() - t0;

// Sort terminal values for percentiles
const sorted = [...results.terminalValues].sort((a, b) => a - b);
const n = sorted.length;
const p10 = sorted[Math.floor(0.10 * n)];
const p25 = sorted[Math.floor(0.25 * n)];
const p50 = sorted[Math.floor(0.50 * n)];
const p75 = sorted[Math.floor(0.75 * n)];
const p90 = sorted[Math.floor(0.90 * n)];

const fmt = (v: number) => "$" + Math.round(v).toLocaleString();

console.log("--- Results ---");
console.log(`Probability of success:     ${(results.probabilityOfSuccess * 100).toFixed(1)}%`);
console.log(`Median nominal target:      ${fmt(results.medianNominalTarget)}`);
console.log("");
console.log("Terminal portfolio distribution:");
console.log(`  p10: ${fmt(p10)}`);
console.log(`  p25: ${fmt(p25)}`);
console.log(`  p50: ${fmt(p50)}`);
console.log(`  p75: ${fmt(p75)}`);
console.log(`  p90: ${fmt(p90)}`);
console.log("");
console.log(`Deterministic path terminal: ${fmt(results.deterministicPath[results.horizonMonths])}`);
console.log(`Run time: ${elapsed.toFixed(0)} ms`);

// ---------------------------------------------------------------------------
// Sanity checks
// ---------------------------------------------------------------------------
console.log("");
console.log("--- Sanity Checks ---");

// Glidepath allocations
const checks: [number, number][] = [
  [0, 0.90],
  [5, 0.90],
  [10, 0.90],
  [12.5, 0.70],
  [15, 0.50],
  [16.5, 0.35],
  [18, 0.20],
];
for (const [age, expectedEq] of checks) {
  const actual = glidepathEquityFraction(age);
  const ok = Math.abs(actual - expectedEq) < 0.001;
  console.log(
    `  Glidepath age ${age.toString().padStart(4)}: equity=${(actual * 100).toFixed(1)}%  expected=${(expectedEq * 100).toFixed(1)}%  ${ok ? "OK" : "FAIL"}`
  );
}

// Deterministic path should be monotone-ish with positive contributions
const det = results.deterministicPath;
const detFinal = det[det.length - 1];
const detStart = det[0];
console.log(`  Deterministic path starts at ${fmt(detStart)}, ends at ${fmt(detFinal)}: ${detFinal > detStart ? "OK (growing)" : "FAIL"}`);

// p50 > p10, p90 > p50
console.log(`  p10 < p50 < p90: ${p10 < p50 && p50 < p90 ? "OK" : "FAIL"}`);

// Prob of success between 0 and 1
const prob = results.probabilityOfSuccess;
console.log(`  Prob in [0,1]: ${prob >= 0 && prob <= 1 ? "OK" : "FAIL"}`);

// ---------------------------------------------------------------------------
// Second scenario: older child, higher balance
// ---------------------------------------------------------------------------
console.log("");
console.log("=== Scenario 2: age 10, $50k balance, $800/mo, private ===");
const inputs2: SimulationInputs = {
  childAge: 10,
  currentBalance: 50_000,
  monthlyContributions: buildFlatContributions(8 * 12, 800),
  todayTuitionTarget: BENCHMARK_COSTS.private,
  useGlidepath: true,
  simulationCount: 5_000,
};
const results2 = runSimulation(inputs2);
const sorted2 = [...results2.terminalValues].sort((a, b) => a - b);
const n2 = sorted2.length;
console.log(`Probability of success: ${(results2.probabilityOfSuccess * 100).toFixed(1)}%`);
console.log(`Median nominal target: ${fmt(results2.medianNominalTarget)}`);
console.log(`p10: ${fmt(sorted2[Math.floor(0.10 * n2)])}`);
console.log(`p50: ${fmt(sorted2[Math.floor(0.50 * n2)])}`);
console.log(`p90: ${fmt(sorted2[Math.floor(0.90 * n2)])}`);

// ---------------------------------------------------------------------------
// Cholesky correlation verification
// Draw N pairs from choleskyDraw2x2(rho) and compute sample Pearson r.
// Expected: realized r ≈ -0.15 (within sampling noise at N=50,000).
// ---------------------------------------------------------------------------
console.log("");
console.log("=== Cholesky Correlation Verification ===");

function sampleCorrelation(rho: number, n: number): number {
  let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
  for (let i = 0; i < n; i++) {
    const [x, y] = choleskyDraw2x2(rho);
    sumX += x; sumY += y;
    sumXX += x * x; sumYY += y * y; sumXY += x * y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  const covXY = sumXY / n - meanX * meanY;
  const stdX = Math.sqrt(sumXX / n - meanX * meanX);
  const stdY = Math.sqrt(sumYY / n - meanY * meanY);
  return covXY / (stdX * stdY);
}

const N = 50_000;
const targetRho = -0.15;
const realized = sampleCorrelation(targetRho, N);
const tolerance = 0.02; // ±0.02 is well within 3σ for N=50k
const rhoOk = Math.abs(realized - targetRho) < tolerance;

console.log(`Target ρ:   ${targetRho.toFixed(4)}`);
console.log(`Realized ρ: ${realized.toFixed(4)}  (N=${N.toLocaleString()})`);
console.log(`Tolerance:  ±${tolerance}  →  ${rhoOk ? "OK" : "FAIL"}`);

// Also confirm X and Y are each marginally standard normal:
// sample means ≈ 0 and sample std devs ≈ 1
let sumX2 = 0, sumY2 = 0, sumXX2 = 0, sumYY2 = 0;
for (let i = 0; i < N; i++) {
  const [x, y] = choleskyDraw2x2(targetRho);
  sumX2 += x; sumY2 += y; sumXX2 += x * x; sumYY2 += y * y;
}
const meanX2 = sumX2 / N;
const meanY2 = sumY2 / N;
const stdX2 = Math.sqrt(sumXX2 / N - meanX2 * meanX2);
const stdY2 = Math.sqrt(sumYY2 / N - meanY2 * meanY2);
console.log(`X marginal: mean=${meanX2.toFixed(4)} std=${stdX2.toFixed(4)}  (expect 0, 1)`);
console.log(`Y marginal: mean=${meanY2.toFixed(4)} std=${stdY2.toFixed(4)}  (expect 0, 1)`);
