/**
 * 529 College Savings Simulation Engine
 *
 * Pure TypeScript — no React dependencies.
 * All stochastic variables are drawn per-path per-month.
 * Contributions are deterministic user inputs.
 */

import {
  SIMULATION_COUNT,
  EQUITY_MEAN_ANNUAL,
  EQUITY_STDDEV_ANNUAL,
  FIXED_INCOME_MEAN_ANNUAL,
  FIXED_INCOME_STDDEV_ANNUAL,
  TUITION_INFLATION_MEAN_ANNUAL,
  TUITION_INFLATION_STDDEV_ANNUAL,
  EQUITY_FI_CORRELATION,
  GLIDEPATH_BREAKPOINTS,
} from "./constants";
import type {
  SimulationInputs,
  SimulationResults,
  PercentilePath,
  YearlySnapshot,
  RepresentativePath,
} from "./types";

// ---------------------------------------------------------------------------
// Box-Muller: generates two independent standard normal samples
// ---------------------------------------------------------------------------
function boxMuller(): [number, number] {
  let u1: number, u2: number;
  do {
    u1 = Math.random();
    u2 = Math.random();
  } while (u1 === 0); // avoid log(0)
  const mag = Math.sqrt(-2.0 * Math.log(u1));
  return [mag * Math.cos(2 * Math.PI * u2), mag * Math.sin(2 * Math.PI * u2)];
}

// ---------------------------------------------------------------------------
// Cholesky decomposition for 2×2 correlation matrix
//
// For equity (X) and fixed income (Y) with correlation ρ:
//   L = [[1, 0], [ρ, sqrt(1 - ρ²)]]
// Then [X, Y] = L · [z1, z2] where z1, z2 ~ N(0,1) independent
// ---------------------------------------------------------------------------
export function choleskyDraw2x2(rho: number): [number, number] {
  const [z1, z2] = boxMuller();
  const x = z1;
  const y = rho * z1 + Math.sqrt(1 - rho * rho) * z2;
  return [x, y];
}

// ---------------------------------------------------------------------------
// Convert annual return to monthly
// ---------------------------------------------------------------------------
function annualToMonthly(annualReturn: number): number {
  return Math.pow(1 + annualReturn, 1 / 12) - 1;
}

// ---------------------------------------------------------------------------
// Glidepath: equity fraction at a given child age (fractional ok)
// ---------------------------------------------------------------------------
export function glidepathEquityFraction(childAge: number): number {
  const bp = GLIDEPATH_BREAKPOINTS;
  if (childAge <= bp[0][0]) return bp[0][1];
  if (childAge >= bp[bp.length - 1][0]) return bp[bp.length - 1][1];

  for (let i = 1; i < bp.length; i++) {
    const [age0, eq0] = bp[i - 1];
    const [age1, eq1] = bp[i];
    if (childAge <= age1) {
      const t = (childAge - age0) / (age1 - age0);
      return eq0 + t * (eq1 - eq0);
    }
  }
  return bp[bp.length - 1][1];
}

// ---------------------------------------------------------------------------
// Draw a monthly return for one period given annual distribution params.
//
// We draw monthly returns directly:
//   mean_monthly  = (1 + mean_annual)^(1/12) - 1   [compound conversion]
//   stddev_monthly = stddev_annual / sqrt(12)        [i.i.d. scaling]
//
// This ensures that 12 independent monthly draws produce the correct
// annual variance: Var_annual ≈ 12 * Var_monthly = stddev_annual^2.
// ---------------------------------------------------------------------------
function sampleMonthlyReturn(
  annualMean: number,
  annualStdDev: number,
  z: number
): number {
  const monthlyMean = annualToMonthly(annualMean);
  const monthlyStdDev = annualStdDev / Math.sqrt(12);
  return monthlyMean + monthlyStdDev * z;
}

// ---------------------------------------------------------------------------
// Compact yearly record: [startVal, endVal, contrib, eqRet, fiRet, portRet, inflRet]
// ---------------------------------------------------------------------------
type YearRecord = [number, number, number, number, number, number, number];

function buildSnapshots(
  childAge: number,
  records: YearRecord[],
  partialMonths: number
): YearlySnapshot[] {
  return records.map((r, y) => {
    const isPartial = y === records.length - 1 && partialMonths > 0;
    return {
      year: y + 1,
      childAgeAtStart: childAge + y,
      months: isPartial ? partialMonths : 12,
      startValue: r[0],
      endValue: r[1],
      annualContribution: r[2],
      equityReturnAnnual: r[3],
      fiReturnAnnual: r[4],
      portfolioReturnAnnual: r[5],
      tuitionInflationAnnual: r[6],
    };
  });
}

// ---------------------------------------------------------------------------
// Main simulation function
// ---------------------------------------------------------------------------
export function runSimulation(inputs: SimulationInputs): SimulationResults {
  const {
    childAge,
    currentBalance,
    monthlyContributions,
    todayTuitionTarget,
    useGlidepath,
    customEquityFraction,
  } = inputs;

  const equityMean = inputs.equityMeanAnnual ?? EQUITY_MEAN_ANNUAL;
  const equityStdDev = inputs.equityStdDevAnnual ?? EQUITY_STDDEV_ANNUAL;
  const fiMean = inputs.fixedIncomeMeanAnnual ?? FIXED_INCOME_MEAN_ANNUAL;
  const fiStdDev = inputs.fixedIncomeStdDevAnnual ?? FIXED_INCOME_STDDEV_ANNUAL;
  const inflationMean = inputs.tuitionInflationMeanAnnual ?? TUITION_INFLATION_MEAN_ANNUAL;
  const inflationStdDev = inputs.tuitionInflationStdDevAnnual ?? TUITION_INFLATION_STDDEV_ANNUAL;
  const rho = inputs.equityFiCorrelation ?? EQUITY_FI_CORRELATION;
  const numSims = inputs.simulationCount ?? SIMULATION_COUNT;

  const horizonYears = 18 - childAge;
  // childAge = years + months/12, so horizonYears * 12 is always an integer
  const horizonMonths = Math.round(horizonYears * 12);

  if (horizonMonths <= 0) {
    throw new Error("Child age must be less than 18.");
  }

  const partialMonths = horizonMonths % 12;

  // Pad or trim contributions to match horizon
  const contributions = new Array(horizonMonths).fill(0).map((_, i) =>
    i < monthlyContributions.length ? monthlyContributions[i] : 0
  );

  const eqFrac = (age: number) =>
    useGlidepath ? glidepathEquityFraction(age) : (customEquityFraction ?? 0.9);

  // --- Storage ---
  const terminalValues = new Float64Array(numSims);
  const nominalTargets = new Float64Array(numSims);

  // Per-month portfolio values across all sims (for percentile fan chart)
  const allPaths = new Array<Float64Array>(horizonMonths + 1);
  for (let m = 0; m <= horizonMonths; m++) {
    allPaths[m] = new Float64Array(numSims);
  }

  // Yearly snapshots per sim (for representative path extraction)
  const simYearlyData: YearRecord[][] = new Array(numSims);

  // --- Welford online stats for diagnostics ---
  // Tracks monthly return draws to compute realized annual mean/stddev/correlation.
  // Welford: mean_n = mean_{n-1} + (x - mean_{n-1}) / n
  //          M2_n  = M2_{n-1}  + (x - mean_{n-1}) * (x - mean_n)
  //          variance = M2 / (n - 1)
  let diagN = 0;
  let diagEqMean = 0, diagEqM2 = 0;
  let diagFIMean = 0, diagFIM2 = 0;
  let diagInflMean = 0, diagInflM2 = 0;
  // Cross-product accumulator for Pearson correlation (equity × FI)
  let diagEqFICross = 0; // sum of (eq - meanEq)(fi - meanFI) — updated after each pass using provisional means

  // --- Run simulations ---
  for (let sim = 0; sim < numSims; sim++) {
    let portfolio = currentBalance;
    let nominalTarget = todayTuitionTarget;
    allPaths[0][sim] = portfolio;

    const yearRecords: YearRecord[] = [];

    // Year accumulation state
    let yearStartValue = portfolio;
    let yearContrib = 0;
    let yearEqCompound = 1;
    let yearFICompound = 1;
    let yearInflCompound = 1;
    let monthInYear = 0;

    for (let m = 0; m < horizonMonths; m++) {
      if (monthInYear === 0) yearStartValue = portfolio;

      const ageAtMonth = childAge + m / 12;
      const ef = eqFrac(ageAtMonth);
      const ff = 1 - ef;

      const [ze, zfi] = choleskyDraw2x2(rho);
      const [zinf] = boxMuller();

      const monthlyEquity = sampleMonthlyReturn(equityMean, equityStdDev, ze);
      const monthlyFI = sampleMonthlyReturn(fiMean, fiStdDev, zfi);
      const monthlyInflation = sampleMonthlyReturn(inflationMean, inflationStdDev, zinf);

      // Welford online update for diagnostics
      diagN++;
      const eqDelta1 = monthlyEquity - diagEqMean;
      diagEqMean += eqDelta1 / diagN;
      diagEqM2 += eqDelta1 * (monthlyEquity - diagEqMean);

      const fiDelta1 = monthlyFI - diagFIMean;
      diagFIMean += fiDelta1 / diagN;
      diagFIM2 += fiDelta1 * (monthlyFI - diagFIMean);

      const inflDelta1 = monthlyInflation - diagInflMean;
      diagInflMean += inflDelta1 / diagN;
      diagInflM2 += inflDelta1 * (monthlyInflation - diagInflMean);

      // Running cross-product for correlation (using current provisional means)
      diagEqFICross += (monthlyEquity - diagEqMean) * (monthlyFI - diagFIMean);

      yearEqCompound *= (1 + monthlyEquity);
      yearFICompound *= (1 + monthlyFI);
      yearInflCompound *= (1 + monthlyInflation);

      const blendedReturn = ef * monthlyEquity + ff * monthlyFI;
      portfolio = portfolio * (1 + blendedReturn) + contributions[m];
      if (portfolio < 0) portfolio = 0;
      nominalTarget *= (1 + monthlyInflation);
      yearContrib += contributions[m];
      allPaths[m + 1][sim] = portfolio;

      monthInYear++;

      const yearComplete = monthInYear === 12;
      const lastMonth = m === horizonMonths - 1;

      if (yearComplete || lastMonth) {
        const y = yearRecords.length;
        // Use midpoint-of-year age for blended allocation approximation
        const midAge = childAge + y + (monthInYear / 2) / 12;
        const efMid = eqFrac(midAge);
        const months = monthInYear;
        const annFactor = 12 / months;

        const eqRet = months === 12 ? yearEqCompound - 1 : Math.pow(yearEqCompound, annFactor) - 1;
        const fiRet = months === 12 ? yearFICompound - 1 : Math.pow(yearFICompound, annFactor) - 1;
        const inflRet = months === 12 ? yearInflCompound - 1 : Math.pow(yearInflCompound, annFactor) - 1;
        const portRet = efMid * eqRet + (1 - efMid) * fiRet;

        yearRecords.push([yearStartValue, portfolio, yearContrib, eqRet, fiRet, portRet, inflRet]);

        // Reset accumulators
        monthInYear = 0;
        yearContrib = 0;
        yearEqCompound = 1;
        yearFICompound = 1;
        yearInflCompound = 1;
      }
    }

    terminalValues[sim] = portfolio;
    nominalTargets[sim] = nominalTarget;
    simYearlyData[sim] = yearRecords;
  }

  // --- Probability of success ---
  let successCount = 0;
  for (let sim = 0; sim < numSims; sim++) {
    if (terminalValues[sim] >= nominalTargets[sim]) successCount++;
  }
  const probabilityOfSuccess = successCount / numSims;

  // --- Median nominal target ---
  const sortedTargets = Array.from(nominalTargets).sort((a, b) => a - b);
  const medianNominalTarget = sortedTargets[Math.floor(numSims / 2)];

  // --- Percentile paths ---
  const PERCENTILES = [0.10, 0.25, 0.50, 0.75, 0.90];
  const LABELS = ["p10", "p25", "p50", "p75", "p90"];

  const percentilePaths: PercentilePath[] = LABELS.map((label) => ({
    label,
    values: new Array(horizonMonths + 1).fill(0),
  }));

  const monthBuffer = new Float64Array(numSims);
  for (let m = 0; m <= horizonMonths; m++) {
    monthBuffer.set(allPaths[m]);
    const sorted = Array.from(monthBuffer).sort((a, b) => a - b);
    for (let p = 0; p < PERCENTILES.length; p++) {
      const idx = Math.floor(PERCENTILES[p] * numSims);
      percentilePaths[p].values[m] = sorted[idx];
    }
  }

  // --- Deterministic path (mean returns, mean inflation) ---
  const deterministicPath: number[] = new Array(horizonMonths + 1);
  deterministicPath[0] = currentBalance;
  let detPortfolio = currentBalance;
  const detMonthlyEquity = annualToMonthly(equityMean);
  const detMonthlyFI = annualToMonthly(fiMean);

  const detYearRecords: YearRecord[] = [];
  let detYearStart = currentBalance;
  let detYearContrib = 0;
  let detMonthInYear = 0;

  for (let m = 0; m < horizonMonths; m++) {
    if (detMonthInYear === 0) detYearStart = detPortfolio;

    const ageAtMonth = childAge + m / 12;
    const ef = eqFrac(ageAtMonth);
    const ff = 1 - ef;
    const blendedReturn = ef * detMonthlyEquity + ff * detMonthlyFI;
    detPortfolio = detPortfolio * (1 + blendedReturn) + contributions[m];
    if (detPortfolio < 0) detPortfolio = 0;
    deterministicPath[m + 1] = detPortfolio;
    detYearContrib += contributions[m];
    detMonthInYear++;

    const yearComplete = detMonthInYear === 12;
    const lastMonth = m === horizonMonths - 1;

    if (yearComplete || lastMonth) {
      const y = detYearRecords.length;
      const midAge = childAge + y + (detMonthInYear / 2) / 12;
      const efMid = eqFrac(midAge);
      const months = detMonthInYear;
      const annFactor = 12 / months;
      // Annual means are exact for full years; annualize for partial years
      const eqRetDet = months === 12 ? equityMean : Math.pow(1 + detMonthlyEquity, annFactor) - 1;
      const fiRetDet = months === 12 ? fiMean : Math.pow(1 + detMonthlyFI, annFactor) - 1;
      const inflRetDet = months === 12 ? inflationMean : Math.pow(1 + annualToMonthly(inflationMean), annFactor) - 1;
      const portRetDet = efMid * eqRetDet + (1 - efMid) * fiRetDet;

      detYearRecords.push([detYearStart, detPortfolio, detYearContrib, eqRetDet, fiRetDet, portRetDet, inflRetDet]);
      detMonthInYear = 0;
      detYearContrib = 0;
    }
  }

  // --- Representative paths (for scenario table) ---
  // Sort sim indices by terminal value, pick the sim nearest each percentile rank.
  const sortedIndices = Array.from({ length: numSims }, (_, i) => i)
    .sort((a, b) => terminalValues[a] - terminalValues[b]);

  const PCTL_TARGETS = [0.10, 0.25, 0.50, 0.75, 0.90];
  const PCTL_LABELS = ["p10", "p25", "p50", "p75", "p90"];
  const PCTL_DESC = [
    "Representative simulation near the 10th percentile of terminal balances",
    "Representative simulation near the 25th percentile of terminal balances",
    "Representative simulation near the 50th percentile (median) of terminal balances",
    "Representative simulation near the 75th percentile of terminal balances",
    "Representative simulation near the 90th percentile of terminal balances",
  ];

  const representativePaths: RepresentativePath[] = PCTL_LABELS.map((label, i) => {
    const rankIdx = Math.floor(PCTL_TARGETS[i] * numSims);
    const simIdx = sortedIndices[rankIdx];
    return {
      label,
      description: PCTL_DESC[i],
      snapshots: buildSnapshots(childAge, simYearlyData[simIdx], partialMonths),
    };
  });

  representativePaths.push({
    label: "deterministic",
    description: "Fixed mean returns every year: equity " + (equityMean * 100).toFixed(1) + "%, FI " + (fiMean * 100).toFixed(1) + "%, inflation " + (inflationMean * 100).toFixed(1) + "%",
    snapshots: buildSnapshots(childAge, detYearRecords, partialMonths),
  });

  // --- Diagnostics: annualize realized monthly stats ---
  // Monthly variance → annual variance: Var_annual = 12 * Var_monthly (i.i.d. scaling)
  // Monthly mean → annual mean: (1 + mean_monthly)^12 - 1
  const eqVarMonthly = diagN > 1 ? diagEqM2 / (diagN - 1) : 0;
  const fiVarMonthly = diagN > 1 ? diagFIM2 / (diagN - 1) : 0;
  const inflVarMonthly = diagN > 1 ? diagInflM2 / (diagN - 1) : 0;

  const eqMeanAnnualized = Math.pow(1 + diagEqMean, 12) - 1;
  const fiMeanAnnualized = Math.pow(1 + diagFIMean, 12) - 1;
  const inflMeanAnnualized = Math.pow(1 + diagInflMean, 12) - 1;

  const eqStdDevAnnualized = Math.sqrt(eqVarMonthly * 12);
  const fiStdDevAnnualized = Math.sqrt(fiVarMonthly * 12);
  const inflStdDevAnnualized = Math.sqrt(inflVarMonthly * 12);

  // Pearson correlation from running cross-product and variances
  const eqFiCorrRealized = (eqVarMonthly > 0 && fiVarMonthly > 0)
    ? (diagEqFICross / (diagN - 1)) / (Math.sqrt(eqVarMonthly) * Math.sqrt(fiVarMonthly))
    : 0;

  const diagnostics = {
    equityMeanRealized: eqMeanAnnualized,
    equityStdDevRealized: eqStdDevAnnualized,
    fiMeanRealized: fiMeanAnnualized,
    fiStdDevRealized: fiStdDevAnnualized,
    inflationMeanRealized: inflMeanAnnualized,
    inflationStdDevRealized: inflStdDevAnnualized,
    equityFiCorrelationRealized: eqFiCorrRealized,
    totalMonthlyDraws: diagN,
  };

  return {
    probabilityOfSuccess,
    terminalValues: Array.from(terminalValues),
    percentilePaths,
    deterministicPath,
    medianNominalTarget,
    horizonMonths,
    representativePaths,
    diagnostics,
  };
}
