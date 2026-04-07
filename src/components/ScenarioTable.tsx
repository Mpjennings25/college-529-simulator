import { useState } from 'react';
import type { RepresentativePath } from '../lib/types';

interface ScenarioTableProps {
  paths: RepresentativePath[];
}

type ScenarioKey = 'p10' | 'p25' | 'p50' | 'p75' | 'p90' | 'deterministic';

const SCENARIO_OPTIONS: { key: ScenarioKey; label: string; color: string }[] = [
  { key: 'p10',           label: '10th',        color: 'text-red-700 bg-red-50 border-red-200' },
  { key: 'p25',           label: '25th',        color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { key: 'p50',           label: '50th',        color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'p75',           label: '75th',        color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { key: 'p90',           label: '90th',        color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { key: 'deterministic', label: 'Deterministic', color: 'text-amber-700 bg-amber-50 border-amber-200' },
];

const fmtDollars = (v: number) => '$' + Math.round(v).toLocaleString();
const fmtPct = (v: number) => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';

function ReturnCell({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <td className={`px-3 py-2 text-right tabular-nums text-xs ${positive ? 'text-emerald-700' : 'text-red-600'}`}>
      {fmtPct(value)}
    </td>
  );
}

export function ScenarioTable({ paths }: ScenarioTableProps) {
  const [selected, setSelected] = useState<ScenarioKey>('p50');

  const path = paths.find(p => p.label === selected);
;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header row */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Scenario Detail
          </h3>
          {/* Percentile selector */}
          <div className="flex items-center gap-1 flex-wrap">
            {SCENARIO_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSelected(opt.key)}
                className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                  selected === opt.key
                    ? opt.color
                    : 'text-gray-500 bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {path && (
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            {selected !== 'deterministic' && (
              <>
                <span className="font-medium text-gray-500">Note:</span>{' '}
                Percentile paths in the fan chart are assembled from different simulations at each
                month — they are not a single coherent path.{' '}
              </>
            )}
            {path.description}.
          </p>
        )}
      </div>

      {/* Table */}
      {path && path.snapshots.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">Year</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">Age</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium whitespace-nowrap">Start balance</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium whitespace-nowrap">Contributions</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium whitespace-nowrap">Portfolio return</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium whitespace-nowrap">Equity return</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium whitespace-nowrap">FI return</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium whitespace-nowrap">Tuition inflation</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium whitespace-nowrap">End balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {path.snapshots.map((row) => (
                <tr key={row.year} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 text-gray-500">
                    {row.year}
                    {row.months < 12 && (
                      <span className="ml-1 text-gray-400">({row.months}mo)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {Math.floor(row.childAgeAtStart)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700 font-medium">
                    {fmtDollars(row.startValue)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                    {fmtDollars(row.annualContribution)}
                  </td>
                  <ReturnCell value={row.portfolioReturnAnnual} />
                  <ReturnCell value={row.equityReturnAnnual} />
                  <ReturnCell value={row.fiReturnAnnual} />
                  <ReturnCell value={row.tuitionInflationAnnual} />
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700 font-semibold">
                    {fmtDollars(row.endValue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={3} className="px-3 py-2 text-xs text-gray-400">Terminal balance</td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-600">
                  {fmtDollars(path.snapshots.reduce((s, r) => s + r.annualContribution, 0))}
                </td>
                <td colSpan={4} />
                <td className="px-3 py-2 text-right tabular-nums text-sm font-bold text-gray-800">
                  {fmtDollars(path.snapshots[path.snapshots.length - 1]?.endValue ?? 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="h-24 flex items-center justify-center text-gray-300 text-sm">
          No data
        </div>
      )}
    </div>
  );
}
