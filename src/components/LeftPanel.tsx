import { useState } from 'react';
import type { AppInputState, TargetKey, IncreaseRule } from '../types';
import { BENCHMARKS, buildGridFromRules } from '../types';

interface LeftPanelProps {
  state: AppInputState;
  update: (patch: Partial<AppInputState>) => void;
}

// ---- shared input primitives ----

function NumInput({
  value, onChange, min, max, step = 1, prefix, suffix, className = '',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center border border-gray-300 rounded overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 bg-white ${className}`}>
      {prefix && <span className="px-2 text-gray-400 text-sm select-none">{prefix}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 min-w-0 px-2 py-1.5 text-sm outline-none bg-transparent"
      />
      {suffix && <span className="px-2 text-gray-400 text-sm select-none">{suffix}</span>}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
      {children}
    </h2>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-gray-600 font-medium mb-1">{children}</div>;
}

// ---- section components ----

function ChildAccountSection({ state, update }: LeftPanelProps) {
  return (
    <div className="space-y-3">
      <SectionHeader>Child &amp; Account</SectionHeader>
      <div>
        <Label>Child's current age</Label>
        <div className="flex items-center gap-2">
          <NumInput
            value={state.childAge}
            onChange={v => update({ childAge: Math.min(17, Math.max(0, Math.floor(v))) })}
            min={0} max={17} step={1}
            suffix="yr"
            className="w-28"
          />
          <NumInput
            value={state.childAgeMonths}
            onChange={v => update({ childAgeMonths: Math.min(11, Math.max(0, Math.floor(v))) })}
            min={0} max={11} step={1}
            suffix="mo"
            className="w-24"
          />
        </div>
        {state.childAge >= 17 && (
          <p className="text-xs text-amber-600 mt-1">Only 1 year of savings horizon remaining.</p>
        )}
      </div>
      <div>
        <Label>Current 529 balance</Label>
        <NumInput
          value={state.currentBalance}
          onChange={v => update({ currentBalance: Math.max(0, v) })}
          min={0} step={1000}
          prefix="$"
          className="w-44"
        />
      </div>
    </div>
  );
}

function ContributionSection({ state, update }: LeftPanelProps) {
  return (
    <div className="space-y-3">
      <SectionHeader>Contribution Schedule</SectionHeader>

      {/* Level 1: base monthly */}
      <div>
        <Label>Base monthly contribution</Label>
        <NumInput
          value={state.baseMonthly}
          onChange={v => update({ baseMonthly: Math.max(0, v) })}
          min={0} step={50}
          prefix="$"
          suffix="/mo"
          className="w-44"
        />
      </div>

      {/* Level 2: increase rule */}
      <div>
        <Label>Annual increase (optional)</Label>
        <div className="space-y-1.5">
          {(
            [
              ['none', 'No increase'],
              ['pct_per_year', '% per year'],
              ['dollar_per_year', '$ per year'],
              ['one_time', 'One-time step-up'],
            ] as [IncreaseRule, string][]
          ).map(([rule, label]) => (
            <label key={rule} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="increaseRule"
                checked={state.increaseRule === rule}
                onChange={() => update({ increaseRule: rule })}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{label}</span>
              {state.increaseRule === rule && rule === 'pct_per_year' && (
                <NumInput
                  value={state.increasePct}
                  onChange={v => update({ increasePct: Math.max(0, v) })}
                  min={0} max={20} step={0.5}
                  suffix="%"
                  className="w-24 ml-1"
                />
              )}
              {state.increaseRule === rule && rule === 'dollar_per_year' && (
                <NumInput
                  value={state.increaseDollar}
                  onChange={v => update({ increaseDollar: Math.max(0, v) })}
                  min={0} step={10}
                  prefix="$"
                  suffix="/yr"
                  className="w-32 ml-1"
                />
              )}
              {state.increaseRule === rule && rule === 'one_time' && (
                <span className="flex items-center gap-1 ml-1">
                  <span className="text-xs text-gray-500">+</span>
                  <NumInput
                    value={state.oneTimeAmount}
                    onChange={v => update({ oneTimeAmount: Math.max(0, v) })}
                    min={0} step={50}
                    prefix="$"
                    suffix="/mo"
                    className="w-28"
                  />
                  <span className="text-xs text-gray-500">at year</span>
                  <NumInput
                    value={state.oneTimeYear}
                    onChange={v => update({ oneTimeYear: Math.max(1, Math.min(18 - state.childAge, Math.floor(v))) })}
                    min={1} max={18 - state.childAge} step={1}
                    className="w-14"
                  />
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Level 3: annual grid toggle */}
      <div>
        <button
          onClick={() => {
            if (!state.showGrid) {
              update({ showGrid: true, gridValues: buildGridFromRules(state) });
            } else {
              update({ showGrid: false });
            }
          }}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          <span className={`transition-transform ${state.showGrid ? 'rotate-90' : ''}`}>▶</span>
          {state.showGrid ? 'Hide' : 'Show'} annual breakdown
        </button>

        {state.showGrid && (
          <div className="mt-2 border border-gray-200 rounded overflow-hidden">
            <div className="grid grid-cols-[40px_48px_1fr] bg-gray-50 border-b border-gray-200 px-2 py-1.5 text-xs text-gray-500 font-medium gap-2">
              <span>Year</span>
              <span>Age</span>
              <span>Monthly</span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
              {Array.from({ length: Math.max(0, 18 - state.childAge) }, (_, y) => (
                <div
                  key={y}
                  className="grid grid-cols-[40px_48px_1fr] items-center px-2 py-1 gap-2 text-xs text-gray-700"
                >
                  <span className="text-gray-400">{y + 1}</span>
                  <span className="text-gray-500">{state.childAge + y}</span>
                  <NumInput
                    value={state.gridValues[y] ?? 0}
                    onChange={v => {
                      const next = [...state.gridValues];
                      next[y] = Math.max(0, v);
                      update({ gridValues: next });
                    }}
                    min={0} step={50}
                    prefix="$"
                    className="text-xs"
                  />
                </div>
              ))}
            </div>
            <div className="px-2 py-1.5 bg-gray-50 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                Editing directly. Level 1/2 changes regenerate this schedule.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TargetSection({ state, update }: LeftPanelProps) {
  const yearsToCollege = Math.max(0, 18 - state.childAge);
  const fmtK = (v: number) => `$${Math.round(v / 1000)}k`;

  return (
    <div className="space-y-2">
      <SectionHeader>Savings Target</SectionHeader>

      <div className="grid grid-cols-2 gap-2">
        {(Object.entries(BENCHMARKS) as [Exclude<TargetKey, 'custom'>, { label: string; today: number }][]).map(
          ([key, bench]) => {
            const projected = bench.today * Math.pow(1 + state.inflationMean, yearsToCollege);
            const selected = state.targetKey === key;
            return (
              <button
                key={key}
                onClick={() => update({ targetKey: key })}
                className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                  selected
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="font-semibold leading-tight mb-1">{bench.label}</div>
                <div className="text-gray-500">Today: {fmtK(bench.today)}</div>
                {yearsToCollege > 0 ? (
                  <div className={selected ? 'text-blue-700 font-medium' : 'text-gray-600'}>
                    ~{fmtK(projected)} at 18
                  </div>
                ) : null}
              </button>
            );
          }
        )}
      </div>

      {/* Custom target */}
      <button
        onClick={() => update({ targetKey: 'custom' })}
        className={`w-full mt-1 flex items-center gap-2 p-2.5 rounded-lg border text-xs text-left transition-colors ${
          state.targetKey === 'custom'
            ? 'border-blue-500 bg-blue-50 text-blue-900'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700'
        }`}
      >
        <span className="font-semibold">Custom amount</span>
        {state.targetKey === 'custom' && (
          <span onClick={e => e.stopPropagation()}>
            <NumInput
              value={state.customTargetValue}
              onChange={v => update({ customTargetValue: Math.max(0, v) })}
              min={0} step={10000}
              prefix="$"
              className="w-36"
            />
          </span>
        )}
        {state.targetKey !== 'custom' && (
          <span className="text-gray-400">click to set custom amount</span>
        )}
      </button>
    </div>
  );
}

function InvestmentSection({ state, update }: LeftPanelProps) {
  return (
    <div className="space-y-2">
      <SectionHeader>Investment Vehicle</SectionHeader>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="radio"
          name="vehicle"
          checked={state.useGlidepath}
          onChange={() => update({ useGlidepath: true })}
          className="mt-0.5 accent-blue-600"
        />
        <div>
          <div className="text-sm text-gray-700 font-medium">Enrollment date fund (glidepath)</div>
          <div className="text-xs text-gray-400">
            90% equity → 20% equity, shifting linearly ages 10–18
          </div>
        </div>
      </label>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="radio"
          name="vehicle"
          checked={!state.useGlidepath}
          onChange={() => update({ useGlidepath: false })}
          className="mt-0.5 accent-blue-600"
        />
        <div className="flex-1">
          <div className="text-sm text-gray-700 font-medium">Custom fixed allocation</div>
          {!state.useGlidepath && (
            <div className="flex items-center gap-2 mt-1.5">
              <NumInput
                value={Math.round(state.customEquityFraction * 100)}
                onChange={v => update({ customEquityFraction: Math.min(1, Math.max(0, v / 100)) })}
                min={0} max={100} step={5}
                suffix="% equity"
                className="w-36"
              />
              <span className="text-xs text-gray-400">
                / {Math.round((1 - state.customEquityFraction) * 100)}% fixed income
              </span>
            </div>
          )}
        </div>
      </label>
    </div>
  );
}

function AdvancedSection({ state, update }: LeftPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-semibold uppercase tracking-wider w-full"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        Advanced Assumptions
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Equity mean return</Label>
              <NumInput
                value={parseFloat((state.equityMean * 100).toFixed(2))}
                onChange={v => update({ equityMean: v / 100 })}
                min={-20} max={40} step={0.5}
                suffix="%"
              />
            </div>
            <div>
              <Label>Equity std dev</Label>
              <NumInput
                value={parseFloat((state.equityStdDev * 100).toFixed(2))}
                onChange={v => update({ equityStdDev: Math.max(0, v / 100) })}
                min={0} max={60} step={0.5}
                suffix="%"
              />
            </div>
            <div>
              <Label>Fixed income mean</Label>
              <NumInput
                value={parseFloat((state.fiMean * 100).toFixed(2))}
                onChange={v => update({ fiMean: v / 100 })}
                min={-10} max={20} step={0.5}
                suffix="%"
              />
            </div>
            <div>
              <Label>Fixed income std dev</Label>
              <NumInput
                value={parseFloat((state.fiStdDev * 100).toFixed(2))}
                onChange={v => update({ fiStdDev: Math.max(0, v / 100) })}
                min={0} max={30} step={0.5}
                suffix="%"
              />
            </div>
            <div>
              <Label>Tuition inflation mean</Label>
              <NumInput
                value={parseFloat((state.inflationMean * 100).toFixed(2))}
                onChange={v => update({ inflationMean: v / 100 })}
                min={0} max={20} step={0.5}
                suffix="%"
              />
            </div>
            <div>
              <Label>Tuition inflation std dev</Label>
              <NumInput
                value={parseFloat((state.inflationStdDev * 100).toFixed(2))}
                onChange={v => update({ inflationStdDev: Math.max(0, v / 100) })}
                min={0} max={10} step={0.25}
                suffix="%"
              />
            </div>
          </div>
          <div className="w-52">
            <Label>Equity / FI correlation (ρ)</Label>
            <NumInput
              value={parseFloat(state.rho.toFixed(3))}
              onChange={v => update({ rho: Math.max(-0.99, Math.min(0.99, v)) })}
              min={-0.99} max={0.99} step={0.05}
            />
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            All values are annual, nominal. Equity and fixed income returns are correlated at ρ.
            Tuition inflation is modeled independently.
          </p>
        </div>
      )}
    </div>
  );
}

export function LeftPanel({ state, update }: LeftPanelProps) {
  return (
    <div className="divide-y divide-gray-100">
      <div className="px-4 py-4">
        <ChildAccountSection state={state} update={update} />
      </div>
      <div className="px-4 py-4">
        <ContributionSection state={state} update={update} />
      </div>
      <div className="px-4 py-4">
        <TargetSection state={state} update={update} />
      </div>
      <div className="px-4 py-4">
        <InvestmentSection state={state} update={update} />
      </div>
      <div className="px-4 py-4">
        <AdvancedSection state={state} update={update} />
      </div>
    </div>
  );
}
