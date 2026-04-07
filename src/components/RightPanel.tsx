import { FanChart } from './FanChart';
import { ScenarioTable } from './ScenarioTable';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import type { SimulationResults, SimulationInputs } from '../lib/types';
import type { AppInputState } from '../types';
import { getTargetToday } from '../types';

interface RightPanelProps {
  results: SimulationResults | null;
  isRunning: boolean;
  state: AppInputState;
  simInputs: SimulationInputs;
}

function probColor(p: number): string {
  if (p >= 0.80) return '#059669'; // emerald-600
  if (p >= 0.60) return '#d97706'; // amber-600
  return '#dc2626';                // red-600
}

const fmtDollars = (v: number) =>
  '$' + Math.round(v).toLocaleString();

export function RightPanel({ results, isRunning, state, simInputs }: RightPanelProps) {
  const todayTarget = getTargetToday(state);
  const yearsToCollege = Math.max(0, 18 - state.childAge - state.childAgeMonths / 12);
  const projectedTarget = Math.round(
    todayTarget * Math.pow(1 + state.inflationMean, yearsToCollege)
  );

  const prob = results?.probabilityOfSuccess;
  const color = prob !== undefined ? probColor(prob) : '#9ca3af';

  return (
    <div className="p-6 space-y-5 max-w-3xl">

      {/* Probability of success */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">
              Probability of meeting target
            </p>
            <div className="flex items-baseline gap-3">
              {prob !== undefined ? (
                <span
                  className="text-6xl font-bold leading-none tabular-nums"
                  style={{ color }}
                >
                  {(prob * 100).toFixed(1)}%
                </span>
              ) : (
                <span className="text-6xl font-bold leading-none text-gray-200">—</span>
              )}
              {isRunning && (
                <span className="text-xs text-gray-400 animate-pulse">recalculating…</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              based on 5,000 simulated paths
            </p>
          </div>

          {/* Target summary */}
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Target at age 18</p>
            <p className="text-sm font-semibold text-gray-700">
              {fmtDollars(projectedTarget)}
            </p>
            <p className="text-xs text-gray-400">
              ({fmtDollars(todayTarget)} today · {(state.inflationMean * 100).toFixed(1)}% inflation)
            </p>
          </div>
        </div>

        {/* Percentile bar if results available */}
        {results && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2">Terminal portfolio distribution</p>
            <div className="grid grid-cols-5 gap-2 text-center">
              {(['p10', 'p25', 'p50', 'p75', 'p90'] as const).map((label, i) => (
                <div key={label}>
                  <div className="text-xs font-semibold text-gray-700 tabular-nums">
                    {fmtDollars(results.percentilePaths[i].values[results.horizonMonths])}
                  </div>
                  <div className="text-xs text-gray-400">{label.replace('p', '')}th</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fan chart */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 pt-4 pb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 px-1">
          Portfolio Distribution Over Time
        </h3>
        {results ? (
          <FanChart
            results={results}
            childAge={state.childAge}
            todayTarget={todayTarget}
            inflationMean={state.inflationMean}
          />
        ) : (
          <div className="h-72 flex items-center justify-center text-gray-300 text-sm">
            Calculating…
          </div>
        )}
      </div>

      {/* Scenario detail table */}
      {results && (
        <ScenarioTable paths={results.representativePaths} />
      )}

      {/* Diagnostics */}
      {results && (
        <DiagnosticsPanel diagnostics={results.diagnostics} inputs={simInputs} />
      )}

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 leading-relaxed px-1">
        Not financial or tax advice. Does not model 529 plan rules, contribution limits, tax
        treatment, or financial aid impact. Nominal dollars throughout — no inflation adjustment
        to portfolio values.
      </p>
    </div>
  );
}
