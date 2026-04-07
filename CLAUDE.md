# 529 College Savings Simulator — Project Context

## Project Overview
A stochastic 529 college savings simulation tool for analytically-minded users. The core value proposition: deterministic models show one path; this tool shows the full distribution of outcomes and the probability a savings plan succeeds. Built as a React PWA, deployed to Vercel.

---

## Tech Stack
- **Framework:** React (Vite)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Deployment:** Vercel
- **Package manager:** npm

---

## Simulation Engine — Spec

### Philosophy
> "Your contributions are your plan — you control them. What you can't control is what markets return or what college costs when your child enrolls."

Stochastic modeling applies only to variables outside the user's control. Contributions are deterministic user inputs.

### Random Variables (3 total)
| Variable | Distribution | Mean | Std Dev | Notes |
|---|---|---|---|---|
| Equity returns | Normal | 10.0% nominal | 16.0% | Annual, US large cap |
| Fixed income returns | Normal | 4.5% nominal | 6.0% | Annual |
| Tuition inflation | Normal | 5.0% nominal | 2.0% | Independent of market returns |

### Correlation Structure
- Equity and fixed income returns: **correlated at ρ = -0.15** (bivariate normal via Cholesky decomposition)
- Tuition inflation: **independent** of both market variables
- Rationale: equity/FI correlation is historically estimable; tuition/market correlation is unstable across regimes and not modeled (transparent simplification, not a claim about reality)

### Simulation Parameters
- **Periods:** Monthly (annual returns converted to monthly: r_monthly = (1 + r_annual)^(1/12) - 1)
- **Number of simulations:** 5,000 (balance of stability at tail percentiles vs. browser performance)
- **Time horizon:** (18 - child's current age) years

### Glidepath (Default Investment Vehicle)
Generic Vanguard-style enrollment date fund:
- Age 0–10: ~90% equity / 10% fixed income
- Age 10–15: linear glide from 90/10 → 50/50
- Age 15–18: linear glide from 50/50 → 20/80
- Allocation is recalculated each monthly period based on remaining years to age 18

### Nominal Throughout
Everything is nominal dollars. No real return conversions. Tuition inflation inflates the target forward from today's dollars. Contributions are nominal and fixed per user input.

### Target Calculation
```
nominalTarget = todayTarget × ∏(1 + inflationDraw_t) for t = 1 to horizon
```
Each simulation path draws its own inflation sequence, producing a distribution of nominal targets.

---

## Inputs Spec

### Child Info
- `childAge`: integer, 0–17 (drives horizon)

### Current Balance
- `currentBalance`: number, dollars, default $0

### Contribution Schedule
Three-level progressive disclosure:
- **Level 1 (always visible):** Base monthly contribution (e.g. $500)
- **Level 2 (optional):** Increase rule — recurring % per year, recurring $ per year, or one-time step-up at a specified year
- **Level 3 (optional drill-down):** 18-row editable annual grid showing "Monthly contributions in projection year" — Year 1, Year 2, ... Year 18 with child's age column. Level 1/2 changes regenerate and overwrite the grid.

### Target
- Benchmark tiles: 4-year in-state public, 4-year out-of-state public, 4-year private, graduate school
- Each tile shows: today's cost + projected nominal cost at age 18 (at default 5% inflation)
- Custom entry also available
- `tuitionInflationRate`: adjustable, default 5%

### Investment Vehicle
- Default: enrollment date glidepath (described above)
- Alternative: custom equity/FI split (user-specified, held constant)

### Advanced Assumptions (collapsible)
- Equity mean / std dev
- Fixed income mean / std dev
- Tuition inflation mean / std dev
- Equity/FI correlation

---

## Outputs Spec

### Primary: Probability of Success
Large, prominent number. "Your plan has an X% probability of meeting your target." Defined as: portfolio value at horizon ≥ nominal target for that simulation path.

### Hero Visualization: Fan Chart
- X-axis: time (years/age)
- Y-axis: portfolio value (nominal $)
- Percentile bands: 10th, 25th, 50th, 75th, 90th
- Overlay: deterministic path (fixed mean returns, fixed inflation)
- Overlay: nominal target line (median inflation path)

### Secondary: Terminal Value Distribution
- Histogram of portfolio values at horizon across all simulations
- Target marked as vertical line
- Toggle show/hide — included if it earns its place visually

### Layout
Split-panel: inputs left, outputs right. Inputs and outputs live on the same screen. User edits inputs and sees outputs update in real time (or near-real time — debounced re-simulation on input change).

---

## Code Conventions
- Simulation engine is pure TypeScript, no React dependencies — lives in `src/lib/simulation.ts`
- Engine is unit-testable in isolation before UI wiring
- Use descriptive variable names that match the spec (e.g. `equityReturn`, `fixedIncomeReturn`, `tuitionInflation`, `glidepathAllocation`)
- Cholesky decomposition implemented explicitly, not via library — keep it transparent and auditable
- All magic numbers (default means, std devs, correlation, glidepath breakpoints) live in `src/lib/constants.ts`
- Contributions schedule passed to simulation engine as a flat array of monthly values (length = horizon in months)
- Results object returns: percentile paths (array of arrays), terminal values (array), probability of success (number), deterministic path (array)

---

## Methodology Transparency (UI)
The tool surfaces its assumptions openly. A collapsible "Methodology" section explains:
- Why stochastic vs deterministic
- The three random variables and their parameters
- The correlation structure and why inflation is modeled independently
- The glidepath logic
- Number of simulations and why

Tone: analytically honest, respects user intelligence, no hedging or marketing language.

---

## What This Tool Is Not
- Not a tax advisor or financial advisor
- Not modeling contribution tax treatment or 529 plan-specific rules
- Not accounting for financial aid impact
- These are noted transparently in the UI
