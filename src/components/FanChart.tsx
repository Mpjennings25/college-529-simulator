import { useMemo } from 'react';
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SimulationResults } from '../lib/types';

interface FanChartProps {
  results: SimulationResults;
  childAge: number;
  todayTarget: number;
  inflationMean: number;
}

interface ChartPoint {
  age: number;
  p10: number;
  b1: number; // p25 - p10
  b2: number; // p75 - p25
  b3: number; // p90 - p75
  p50: number;
  det: number;
  target: number;
}

const fmt = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(v / 1_000)}k`;
};

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: number;
}) {
  if (!active || !payload || label == null) return null;

  // Reconstruct actual percentile values from stacked deltas.
  const get = (key: string) => payload.find(p => p.dataKey === key)?.value ?? 0;
  const p10 = get('p10');
  const p25 = p10 + get('b1');
  const p75 = p25 + get('b2');
  const p90 = p75 + get('b3');
  const p50 = get('p50');
  const det = get('det');
  const tgt = get('target');

  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm p-2.5 text-xs space-y-0.5">
      <div className="font-semibold text-gray-700 mb-1">Age {Number(label).toFixed(1)}</div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-500">90th pct</span>
        <span className="font-medium">{fmt(p90)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-blue-700">Median (50th)</span>
        <span className="font-medium text-blue-700">{fmt(p50)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-500">10th pct</span>
        <span className="font-medium">{fmt(p10)}</span>
      </div>
      <div className="border-t border-gray-100 my-1" />
      <div className="flex justify-between gap-4">
        <span className="text-amber-600">Deterministic</span>
        <span className="font-medium text-amber-600">{fmt(det)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-red-600">Tuition target</span>
        <span className="font-medium text-red-600">{fmt(tgt)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-400 text-xs">25th–75th</span>
        <span className="text-gray-400">{fmt(p25)} – {fmt(p75)}</span>
      </div>
    </div>
  );
}

export function FanChart({ results, childAge, todayTarget, inflationMean }: FanChartProps) {
  const chartData = useMemo<ChartPoint[]>(() => {
    const paths = results.percentilePaths;
    const p10arr = paths[0].values;
    const p25arr = paths[1].values;
    const p75arr = paths[3].values;
    const p90arr = paths[4].values;
    const p50arr = paths[2].values;
    const detArr = results.deterministicPath;

    // Sample every 2 months (reduces SVG complexity, still visually smooth)
    const step = Math.max(1, Math.floor(results.horizonMonths / 108));
    const points: ChartPoint[] = [];

    for (let i = 0; i <= results.horizonMonths; i += step) {
      const idx = Math.min(i, results.horizonMonths);
      const target = todayTarget * Math.pow(1 + inflationMean, idx / 12);
      points.push({
        age: parseFloat((childAge + idx / 12).toFixed(3)),
        p10: p10arr[idx],
        b1: Math.max(0, p25arr[idx] - p10arr[idx]),
        b2: Math.max(0, p75arr[idx] - p25arr[idx]),
        b3: Math.max(0, p90arr[idx] - p75arr[idx]),
        p50: p50arr[idx],
        det: detArr[idx],
        target,
      });
    }

    // Always include the terminal point
    if (points[points.length - 1].age < 18) {
      const i = results.horizonMonths;
      const target = todayTarget * Math.pow(1 + inflationMean, i / 12);
      points.push({
        age: 18,
        p10: p10arr[i],
        b1: Math.max(0, p25arr[i] - p10arr[i]),
        b2: Math.max(0, p75arr[i] - p25arr[i]),
        b3: Math.max(0, p90arr[i] - p75arr[i]),
        p50: p50arr[i],
        det: detArr[i],
        target,
      });
    }

    return points;
  }, [results, childAge, todayTarget, inflationMean]);

  const horizonYears = 18 - childAge;
  const ageTicks = useMemo(() => {
    const step = horizonYears <= 5 ? 1 : 2;
    const ticks: number[] = [];
    for (let age = childAge; age <= 18; age += step) ticks.push(age);
    if (ticks[ticks.length - 1] !== 18) ticks.push(18);
    return ticks;
  }, [childAge, horizonYears]);

  const yFormatter = (v: number) => {
    if (v === 0) return '$0';
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    return `$${Math.round(v / 1_000)}k`;
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="age"
            type="number"
            domain={[childAge, 18]}
            ticks={ageTicks}
            tickFormatter={(v: number) => String(v)}
            label={{ value: "Child's age", position: 'insideBottom', offset: -10, fontSize: 11, fill: '#9ca3af' }}
          />
          <YAxis
            tickFormatter={yFormatter}
            width={58}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Stacked percentile bands: transparent base → outer lo → inner → outer hi */}
          <Area
            stackId="fan" dataKey="p10"
            fill="transparent" stroke="none"
            isAnimationActive={false}
          />
          <Area
            stackId="fan" dataKey="b1"
            fill="#bfdbfe" stroke="none" fillOpacity={0.75}
            isAnimationActive={false}
          />
          <Area
            stackId="fan" dataKey="b2"
            fill="#93c5fd" stroke="none" fillOpacity={0.75}
            isAnimationActive={false}
          />
          <Area
            stackId="fan" dataKey="b3"
            fill="#bfdbfe" stroke="none" fillOpacity={0.75}
            isAnimationActive={false}
          />

          {/* Median */}
          <Line
            dataKey="p50" stroke="#2563eb" strokeWidth={2}
            dot={false} activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
          {/* Deterministic (mean returns) */}
          <Line
            dataKey="det" stroke="#d97706" strokeWidth={1.5}
            dot={false} activeDot={false}
            isAnimationActive={false}
          />
          {/* Target (projected tuition) */}
          <Line
            dataKey="target" stroke="#dc2626" strokeWidth={1.5}
            strokeDasharray="4 4" dot={false} activeDot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Custom legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-1 px-2 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-8 h-3 rounded" style={{ background: 'linear-gradient(to right, #bfdbfe, #93c5fd, #bfdbfe)' }} />
          10th–90th pct
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-8 h-3 rounded" style={{ background: '#93c5fd' }} />
          25th–75th pct
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 border-t-2 border-blue-600" />
          Median
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 border-t-2 border-amber-600" />
          Deterministic
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 border-t-2 border-red-600 border-dashed" />
          Tuition target
        </span>
      </div>
    </div>
  );
}
