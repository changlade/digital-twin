import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Leaf, Zap, Droplets, Wind, TrendingUp } from "lucide-react";
import {
  fetchSustainability,
  fetchSustainabilitySummary,
  fetchBatchCarbonTraceback,
} from "../lib/api";
import type { BatchCarbonRow, SustainabilityRow, SustainabilitySummary } from "../lib/types";
import { fmt, fmtKwh } from "../lib/utils";
import KpiCard from "../components/KpiCard";

function formatHour(ts: string): string {
  try {
    return format(parseISO(ts), "HH:mm");
  } catch {
    return ts.slice(11, 16);
  }
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-sm text-xs space-y-1 min-w-[160px]">
      <p className="text-danone-gray-400 font-mono mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-danone-gray-300">{p.name}:</span>
          <span className="text-white font-medium ml-auto">
            {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SustainabilityPage() {
  const [hourly, setHourly] = useState<SustainabilityRow[]>([]);
  const [summary, setSummary] = useState<SustainabilitySummary[]>([]);
  const [traceback, setTraceback] = useState<BatchCarbonRow[]>([]);
  const [emissionFactor, setEmissionFactor] = useState(0.233);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchSustainability(hours),
      fetchSustainabilitySummary(),
      fetchBatchCarbonTraceback(),
    ])
      .then(([h, s, t]) => {
        setHourly(h);
        setSummary(s);
        setTraceback(t.data);
        setEmissionFactor(t.emission_factor);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [hours]);

  // ── Derived aggregates ──────────────────────────────────────────────────────
  const totalCO2 = summary.reduce((s, r) => s + (r.estimated_co2_kg ?? 0), 0);
  const totalEnergy = summary.reduce((s, r) => s + (r.total_energy_kwh ?? 0), 0);
  const totalWater = summary.reduce((s, r) => s + (r.total_water_liters ?? 0), 0);
  const totalCIP = summary.reduce((s, r) => s + (r.cip_water_liters ?? 0), 0);

  // ── Chart data (aggregate per hour across plants) ───────────────────────────
  const chartData = (() => {
    const buckets = new Map<string, { co2: number; energy: number; water: number; cip: number }>();
    for (const r of hourly) {
      const key = r.hour_bucket?.slice(0, 16) ?? "";
      const prev = buckets.get(key) ?? { co2: 0, energy: 0, water: 0, cip: 0 };
      buckets.set(key, {
        co2: prev.co2 + (r.estimated_co2_kg ?? 0),
        energy: prev.energy + (r.total_energy_kwh ?? 0),
        water: prev.water + (r.total_water_liters ?? 0),
        cip: prev.cip + (r.cip_water_liters ?? 0),
      });
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ts, v]) => ({ t: formatHour(ts), ...v }));
  })();

  // ── Carbon traceback (highest CO₂ batches) ──────────────────────────────────
  const maxCO2 = Math.max(...traceback.map((b) => b.estimated_co2_kg ?? 0), 1);
  const sortedTraceback = [...traceback].sort(
    (a, b) => (b.estimated_co2_kg ?? 0) - (a.estimated_co2_kg ?? 0)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Leaf size={20} className="text-emerald-400" />
            Sustainability Hub
          </h2>
          <p className="text-xs text-danone-gray-500 mt-1">
            Circular Water Twin · Energy Intensity · CO₂ per Batch Traceback
          </p>
        </div>
        <div className="flex gap-2">
          {[6, 12, 24].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={
                hours === h
                  ? "btn-primary px-3 py-1.5 text-xs"
                  : "btn-ghost px-3 py-1.5 text-xs"
              }
            >
              {h}h
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div data-tour="sustainability-kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Est. CO₂ Footprint"
          value={loading ? "—" : `${fmt(totalCO2, 0)} kg`}
          sub={`Emission factor: ${emissionFactor} kgCO₂/kWh`}
          icon={<Wind size={16} />}
          accent="purple"
          loading={loading}
        />
        <KpiCard
          label="Total Energy"
          value={loading ? "—" : fmtKwh(totalEnergy)}
          sub="Across all plants"
          icon={<Zap size={16} />}
          accent="cyan"
          loading={loading}
        />
        <KpiCard
          label="Total Water"
          value={loading ? "—" : `${fmt(totalWater / 1000, 1)} kL`}
          sub={`CIP: ${fmt(totalCIP / 1000, 1)} kL`}
          icon={<Droplets size={16} />}
          accent="blue"
          loading={loading}
        />
        <KpiCard
          label="Energy Intensity"
          value={loading || totalWater === 0 ? "—" : `${fmt(totalEnergy / (totalWater / 1000), 2)} kWh/kL`}
          sub="Target: ≤ 2.5 kWh/kL"
          icon={<TrendingUp size={16} />}
          accent={totalWater > 0 && totalEnergy / (totalWater / 1000) <= 2.5 ? "green" : "yellow"}
          loading={loading}
        />
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* CO₂ & Energy area chart */}
        <div className="card">
          <p className="text-sm font-semibold text-white mb-1">Energy &amp; CO₂ Trend</p>
          <p className="text-xs text-danone-gray-500 mb-4">Hourly totals across all plants</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="gradEnergy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#009EE0" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#009EE0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCO2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8B5CF6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} width={36} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#94A3B8", paddingTop: 8 }} iconSize={8} />
                <Area type="monotone" dataKey="energy" name="Energy (kWh)" stroke="#009EE0" fill="url(#gradEnergy)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="co2"    name="CO₂ (kg)"    stroke="#8B5CF6" fill="url(#gradCO2)"    strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Water area chart */}
        <div className="card">
          <p className="text-sm font-semibold text-white mb-1">Water Consumption</p>
          <p className="text-xs text-danone-gray-500 mb-4">Total vs CIP-only, liters per hour</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="gradWater" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCIP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#06B6D4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} width={36} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#94A3B8", paddingTop: 8 }} iconSize={8} />
                <Area type="monotone" dataKey="water" name="Total Water (L)" stroke="#3B82F6" fill="url(#gradWater)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="cip"   name="CIP Water (L)"   stroke="#06B6D4" fill="url(#gradCIP)"   strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Batch CO₂ Traceback */}
      <div className="card">
        {/* data-tour wraps only the header + chart so the spotlight stays viewport-sized */}
        <div data-tour="carbon-traceback">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-white">Sustainability Traceback — CO₂ per Batch</p>
              <p className="text-xs text-danone-gray-500 mt-0.5">
                Links the biological twin (milk composition) to mechanical energy cost and carbon footprint.
                Batches above average are flagged.
              </p>
            </div>
          </div>

        {/* Bar chart */}
        <div className="h-40 mb-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedTraceback} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="batch_id" tick={{ fontSize: 9, fill: "#64748B" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} width={36} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="estimated_co2_kg" name="CO₂ (kg)" radius={[4, 4, 0, 0]}>
                {sortedTraceback.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={(entry.co2_vs_avg_pct ?? 0) > 10 ? "#EF4444" : (entry.co2_vs_avg_pct ?? 0) > 0 ? "#F59E0B" : "#10B981"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        </div>{/* end data-tour="carbon-traceback" */}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-danone-gray-500 border-b border-danone-gray-700">
                {["Batch", "Plant", "Fat %", "Protein %", "Viscosity", "Energy", "Est. CO₂", "vs Avg", "FTR"].map((h) => (
                  <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-danone-gray-700/40">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="py-2 pr-4">
                          <div className="h-3 bg-danone-gray-700 rounded animate-pulse w-14" />
                        </td>
                      ))}
                    </tr>
                  ))
                : sortedTraceback.map((b) => {
                    const vsAvg = b.co2_vs_avg_pct ?? 0;
                    return (
                      <tr key={b.batch_id} className="hover:bg-danone-gray-700/30 transition-colors">
                        <td className="py-2 pr-4 font-mono text-danone-lightblue font-medium">
                          {b.batch_id}
                        </td>
                        <td className="py-2 pr-4 text-danone-gray-400">P{b.plant_id}</td>
                        <td className="py-2 pr-4 text-white">{fmt(b.avg_fat_pct, 2)}%</td>
                        <td className="py-2 pr-4 text-white">{fmt(b.avg_protein_pct, 2)}%</td>
                        <td className="py-2 pr-4 text-white">{fmt(b.avg_viscosity_cp, 0)} cP</td>
                        <td className="py-2 pr-4 text-white">{fmtKwh(b.total_energy_kwh)}</td>
                        <td className="py-2 pr-4 text-white">{fmt(b.estimated_co2_kg, 1)} kg</td>
                        <td className="py-2 pr-4">
                          <span
                            className={
                              vsAvg > 10
                                ? "badge badge-alarm"
                                : vsAvg > 0
                                ? "badge badge-warning"
                                : "badge badge-ok"
                            }
                          >
                            {vsAvg > 0 ? "+" : ""}
                            {vsAvg.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <span className={(b.ftr_rate_pct ?? 0) >= 95 ? "badge badge-ok" : "badge badge-warning"}>
                            {fmt(b.ftr_rate_pct)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* Narrative callout */}
        {!loading && sortedTraceback.length > 0 && (
          <div className="mt-4 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-danone-gray-300">
            <span className="font-semibold text-yellow-400">Insight: </span>
            {(() => {
              const worst = sortedTraceback[0];
              const best = sortedTraceback[sortedTraceback.length - 1];
              const delta = ((worst.estimated_co2_kg ?? 0) - (best.estimated_co2_kg ?? 0));
              const pct = best.estimated_co2_kg
                ? (delta / best.estimated_co2_kg) * 100
                : 0;
              return `Batch ${worst.batch_id} has a ${pct.toFixed(0)}% higher carbon footprint than batch ${best.batch_id}
              (${fmt(worst.estimated_co2_kg, 1)} vs ${fmt(best.estimated_co2_kg, 1)} kg CO₂).
              Higher fat (${fmt(worst.avg_fat_pct, 1)}%) and viscosity (${fmt(worst.avg_viscosity_cp, 0)} cP) drove
              additional energy demand in the spray dryer and centrifuge stages.`;
            })()}
          </div>
        )}
      </div>

      {/* Per-plant summary */}
      {summary.length > 0 && (
        <div className="card">
          <p className="section-title">Plant-Level Summary</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary.map((s) => (
              <div key={s.plant_id} className="card-sm space-y-2">
                <p className="text-sm font-semibold text-white">Plant {s.plant_id}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-danone-gray-500">Energy</span>
                    <p className="text-white font-medium">{fmtKwh(s.total_energy_kwh)}</p>
                  </div>
                  <div>
                    <span className="text-danone-gray-500">CO₂</span>
                    <p className="text-white font-medium">{fmt(s.estimated_co2_kg, 1)} kg</p>
                  </div>
                  <div>
                    <span className="text-danone-gray-500">Water</span>
                    <p className="text-white font-medium">{fmt(s.total_water_liters / 1000, 1)} kL</p>
                  </div>
                  <div>
                    <span className="text-danone-gray-500">CIP Water</span>
                    <p className="text-white font-medium">{fmt(s.cip_water_liters / 1000, 1)} kL</p>
                  </div>
                </div>
                <div className="h-1.5 bg-danone-gray-700 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${Math.min(100, ((s.total_energy_kwh ?? 0) / Math.max(...summary.map(x => x.total_energy_kwh ?? 0), 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
