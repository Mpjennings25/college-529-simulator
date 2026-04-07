import { useState } from 'react';
import type { SimulationDiagnostics, SimulationInputs } from '../lib/types';

interface DiagnosticsPanelProps {
  diagnostics: SimulationDiagnostics;
  inputs: SimulationInputs;
}

function Row({
  label,
  realized,
  target,
  fmt,
}: {
  label: string;
  realized: number;
  target: number;
  fmt: (v: number) => string;
}) {
  const diff = realized - target;
  const pct = target !== 0 ? diff / Math.abs(target) : 0;
  const ok = Math.abs(pct) < 0.05; // within 5% of target is green

  return (
    <tr className="border-b border-gray-50">
      <td className="py-1.5 pr-4 text-xs text-gray-600 whitespace-nowrap">{label}</td>
      <td className="py-1.5 px-3 text-xs text-right tabular-nums text-gray-800 font-medium">{fmt(realized)}</td>
      <td className="py-1.5 px-3 text-xs text-right tabular-nums text-gray-400">{fmt(target)}</td>
      <td className={`py-1.5 pl-3 text-xs text-right tabular-nums font-medium ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>
        {diff >= 0 ? '+' : ''}{fmt(diff)}
      </td>
    </tr>
  );
}

const fmtPct = (v: number) => (v * 100).toFixed(2) + '%';
const fmtCorr = (v: number) => v.toFixed(4);

export function DiagnosticsPanel({ diagnostics: d, inputs }: DiagnosticsPanelProps) {
  const [open, setOpen] = useState(false);

  const equityTarget = inputs.equityMeanAnnual ?? 0.10;
  const equityStdTarget = inputs.equityStdDevAnnual ?? 0.16;
  const fiTarget = inputs.fixedIncomeMeanAnnual ?? 0.045;
  const fiStdTarget = inputs.fixedIncomeStdDevAnnual ?? 0.06;
  const inflTarget = inputs.tuitionInflationMeanAnnual ?? 0.05;
  const inflStdTarget = inputs.tuitionInflationStdDevAnnual ?? 0.02;
  const rhoTarget = inputs.equityFiCorrelation ?? -0.15;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Simulation Diagnostics
        </span>
        <span className={`text-gray-400 text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 mt-3 mb-3 leading-relaxed">
            Realized statistics computed from all {d.totalMonthlyDraws.toLocaleString()} monthly draws
            across the 5,000 simulations. Annual figures are annualized from monthly:
            mean via (1 + μ_mo)¹²−1, std dev via σ_mo × √12.
            Realized values should be close to targets — small deviations are expected sampling noise.
          </p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-1.5 text-left text-xs font-medium text-gray-400">Statistic</th>
                <th className="pb-1.5 text-right text-xs font-medium text-gray-400">Realized</th>
                <th className="pb-1.5 text-right text-xs font-medium text-gray-400">Target</th>
                <th className="pb-1.5 text-right text-xs font-medium text-gray-400">Δ</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Equity mean return"       realized={d.equityMeanRealized}      target={equityTarget}    fmt={fmtPct} />
              <Row label="Equity std dev"           realized={d.equityStdDevRealized}    target={equityStdTarget} fmt={fmtPct} />
              <Row label="FI mean return"           realized={d.fiMeanRealized}          target={fiTarget}        fmt={fmtPct} />
              <Row label="FI std dev"               realized={d.fiStdDevRealized}        target={fiStdTarget}     fmt={fmtPct} />
              <Row label="Tuition inflation mean"   realized={d.inflationMeanRealized}   target={inflTarget}      fmt={fmtPct} />
              <Row label="Tuition inflation std dev" realized={d.inflationStdDevRealized} target={inflStdTarget}  fmt={fmtPct} />
              <Row label="Equity / FI correlation"  realized={d.equityFiCorrelationRealized} target={rhoTarget}  fmt={fmtCorr} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
