import { useCallback, useState } from 'react';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { useSimulation } from './hooks/useSimulation';
import {
  type AppInputState,
  INITIAL_STATE,
  RULE_KEYS,
  buildGridFromRules,
  buildMonthlyContributions,
  getTargetToday,
} from './types';
import type { SimulationInputs } from './lib/types';

function deriveSimInputs(state: AppInputState): SimulationInputs {
  return {
    childAge: state.childAge + state.childAgeMonths / 12,
    currentBalance: state.currentBalance,
    monthlyContributions: buildMonthlyContributions(state),
    todayTuitionTarget: getTargetToday(state),
    useGlidepath: state.useGlidepath,
    customEquityFraction: state.customEquityFraction,
    equityMeanAnnual: state.equityMean,
    equityStdDevAnnual: state.equityStdDev,
    fixedIncomeMeanAnnual: state.fiMean,
    fixedIncomeStdDevAnnual: state.fiStdDev,
    tuitionInflationMeanAnnual: state.inflationMean,
    tuitionInflationStdDevAnnual: state.inflationStdDev,
    equityFiCorrelation: state.rho,
  };
}

export default function App() {
  const [state, setState] = useState<AppInputState>(() => ({
    ...INITIAL_STATE,
    gridValues: buildGridFromRules(INITIAL_STATE),
  }));

  const update = useCallback((patch: Partial<AppInputState>) => {
    setState(prev => {
      const next = { ...prev, ...patch };
      const rulesChanged = RULE_KEYS.some(k => k in patch);
      const ageChanged = 'childAge' in patch;
      // When child age changes, always resize the grid.
      // When Level 1/2 rules change while grid is open, regenerate it.
      if (ageChanged || (rulesChanged && next.showGrid)) {
        next.gridValues = buildGridFromRules(next);
      }
      return next;
    });
  }, []);

  const simInputs = deriveSimInputs(state);
  const { results, isRunning } = useSimulation(simInputs);

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900 overflow-hidden">
      {/* Header */}
      <header className="flex-none h-11 flex items-center px-5 border-b border-gray-200 bg-white">
        <span className="text-sm font-semibold tracking-tight text-gray-800">
          529 College Savings Simulator
        </span>
      </header>

      {/* Split panel */}
      <main className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
        {/* Left: inputs */}
        <aside className="md:w-[380px] w-full flex-none overflow-y-auto border-r border-gray-200 bg-white">
          <LeftPanel state={state} update={update} />
        </aside>

        {/* Right: outputs */}
        <section className="flex-1 overflow-y-auto bg-gray-50">
          <RightPanel results={results} isRunning={isRunning} state={state} simInputs={simInputs} />
        </section>
      </main>
    </div>
  );
}
