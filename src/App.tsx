import { useCallback, useState, type ReactNode } from 'react';
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

type MobileTab = 'inputs' | 'results';

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [mobileTab, setMobileTab] = useState<MobileTab>('inputs');
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

  const prob = results?.probabilityOfSuccess;

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900 overflow-hidden">
      {/* Header */}
      <header className="flex-none flex items-center px-5 border-b border-gray-200 bg-white h-11">
        <span className="text-sm font-semibold tracking-tight text-gray-800">
          529 College Savings Simulator
        </span>
        {/* Mobile: probability badge in header so it's always visible */}
        {prob !== undefined && (
          <span
            className="md:hidden ml-auto text-sm font-bold tabular-nums"
            style={{ color: prob >= 0.80 ? '#059669' : prob >= 0.60 ? '#d97706' : '#dc2626' }}
          >
            {(prob * 100).toFixed(1)}%
          </span>
        )}
      </header>

      {/* Mobile tab bar */}
      <div className="md:hidden flex border-b border-gray-200 bg-white flex-none">
        <TabButton active={mobileTab === 'inputs'} onClick={() => setMobileTab('inputs')}>
          Inputs
        </TabButton>
        <TabButton active={mobileTab === 'results'} onClick={() => { setMobileTab('results'); }}>
          Results
        </TabButton>
      </div>

      {/* Split panel — desktop: side-by-side; mobile: tabs */}
      <main className="flex-1 overflow-hidden flex min-h-0 md:flex-row flex-col">
        {/* Left: inputs */}
        <aside className={`md:w-[380px] md:flex md:flex-none flex-1 min-h-0 overflow-y-auto border-r border-gray-200 bg-white flex-col ${mobileTab === 'inputs' ? 'flex' : 'hidden'}`}>
          <LeftPanel state={state} update={update} />
        </aside>

        {/* Right: outputs */}
        <section className={`md:flex flex-1 overflow-y-auto bg-gray-50 flex-col ${mobileTab === 'results' ? 'flex' : 'hidden'}`}>
          <RightPanel results={results} isRunning={isRunning} state={state} simInputs={simInputs} />
        </section>
      </main>
    </div>
  );
}
