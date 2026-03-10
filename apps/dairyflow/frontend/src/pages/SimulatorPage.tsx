import { useEffect, useRef, useState } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { FlaskConical, Play, RotateCcw, ChevronDown, Zap, Wind, Star, Thermometer } from "lucide-react";
import { fetchSimulatableBatches, runSimulation } from "../lib/api";
import type { SimulationResult } from "../lib/types";
import { fmt } from "../lib/utils";

// ─── Slider ───────────────────────────────────────────────────────────────────
function Slider({
  label, value, min, max, step, unit, onChange, description,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  description?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <label className="text-xs font-semibold text-danone-gray-300">{label}</label>
        <span className="text-sm font-bold text-white font-mono">
          {value >= 0 ? "+" : ""}{value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>
      {description && <p className="text-[10px] text-danone-gray-500">{description}</p>}
      <div className="relative h-6 flex items-center">
        <div className="w-full h-1.5 bg-danone-gray-700 rounded-full" />
        <div
          className="absolute h-1.5 bg-danone-lightblue rounded-full"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer h-6"
        />
        <div
          className="absolute w-4 h-4 rounded-full bg-danone-lightblue border-2 border-white shadow-lg pointer-events-none"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-danone-gray-600">
        <span>{min >= 0 ? "+" : ""}{min}{unit}</span>
        <span>{max >= 0 ? "+" : ""}{max}{unit}</span>
      </div>
    </div>
  );
}

// ─── Delta badge ──────────────────────────────────────────────────────────────
function Delta({ value, unit, goodIfNegative = false }: { value: number; unit: string; goodIfNegative?: boolean }) {
  const isGood = goodIfNegative ? value <= 0 : value >= 0;
  const color = isGood ? "text-emerald-400" : "text-red-400";
  return (
    <span className={`text-xs font-semibold font-mono ${color}`}>
      {value >= 0 ? "▲" : "▼"} {Math.abs(value).toFixed(2)}{unit}
    </span>
  );
}

// ─── Result card ──────────────────────────────────────────────────────────────
function ResultPanel({ result }: { result: SimulationResult }) {
  const radarData = [
    { metric: "Quality", baseline: result.baseline.quality_score, simulated: result.simulated.quality_score },
    { metric: "Energy Eff.", baseline: Math.max(0, 100 - result.baseline.energy_kwh / 2), simulated: Math.max(0, 100 - result.simulated.energy_kwh / 2) },
    { metric: "FTR", baseline: result.baseline.ftr_rate_pct, simulated: result.baseline.ftr_rate_pct + result.deltas.quality_score * 0.3 },
    { metric: "CO₂ Eff.", baseline: Math.max(0, 100 - result.baseline.co2_kg), simulated: Math.max(0, 100 - result.simulated.co2_kg) },
    { metric: "Viscosity", baseline: Math.min(100, result.baseline.viscosity_cp / 2), simulated: Math.min(100, result.simulated.viscosity_cp / 2) },
  ];

  const comparisonData = [
    { name: "Energy (kWh)", baseline: result.baseline.energy_kwh, simulated: result.simulated.energy_kwh },
    { name: "CO₂ (kg)", baseline: result.baseline.co2_kg, simulated: result.simulated.co2_kg },
    { name: "Quality", baseline: result.baseline.quality_score, simulated: result.simulated.quality_score },
  ];

  const recColor =
    result.recommendation.startsWith("Optimal")  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" :
    result.recommendation.startsWith("Caution")  ? "border-red-500/30 bg-red-500/10 text-red-300" :
    result.recommendation.startsWith("Quality i") ? "border-danone-blue/30 bg-danone-blue/10 text-blue-300" :
    result.recommendation.startsWith("Quality d") ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300" :
    "border-danone-gray-700 bg-danone-gray-800 text-danone-gray-300";

  return (
    <div className="space-y-5 animate-slide-in">
      {/* Recommendation */}
      <div className={`px-4 py-3 rounded-lg border text-sm font-medium ${recColor}`}>
        💡 {result.recommendation}
      </div>

      {/* Delta KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Energy Δ", value: result.deltas.energy_kwh, unit: " kWh", goodIfNeg: true, icon: <Zap size={14} /> },
          { label: "CO₂ Δ", value: result.deltas.co2_kg, unit: " kg", goodIfNeg: true, icon: <Wind size={14} /> },
          { label: "Quality Δ", value: result.deltas.quality_score, unit: " pts", goodIfNeg: false, icon: <Star size={14} /> },
          { label: "Viscosity Δ", value: result.simulated.viscosity_cp - result.baseline.viscosity_cp, unit: " cP", goodIfNeg: false, icon: <Thermometer size={14} /> },
        ].map(({ label, value, unit, goodIfNeg, icon }) => {
          const isGood = goodIfNeg ? value <= 0 : value >= 0;
          return (
            <div key={label} className="card-sm text-center">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center mx-auto mb-2 ${isGood ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                {icon}
              </div>
              <p className="text-[10px] text-danone-gray-500 mb-1">{label}</p>
              <Delta value={value} unit={unit} goodIfNegative={goodIfNeg} />
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Radar */}
        <div className="card">
          <p className="text-sm font-semibold text-white mb-3">Multi-Dimensional Impact</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <Radar name="Baseline" dataKey="baseline" stroke="#64748B" fill="#64748B" fillOpacity={0.2} strokeWidth={1.5} />
                <Radar name="Simulated" dataKey="simulated" stroke="#009EE0" fill="#009EE0" fillOpacity={0.25} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#94A3B8" }} iconSize={8} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar comparison */}
        <div className="card">
          <p className="text-sm font-semibold text-white mb-3">Baseline vs Simulated</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: "#1E293B", border: "1px solid #334155", fontSize: 11 }}
                  labelStyle={{ color: "#94A3B8" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#94A3B8" }} iconSize={8} />
                <Bar dataKey="baseline" name="Baseline" fill="#475569" radius={[4, 4, 0, 0]}>
                  {comparisonData.map((_, i) => <Cell key={i} fill="#475569" />)}
                </Bar>
                <Bar dataKey="simulated" name="Simulated" radius={[4, 4, 0, 0]}>
                  {comparisonData.map((entry, i) => (
                    <Cell key={i} fill={entry.simulated < entry.baseline ? "#10B981" : entry.simulated > entry.baseline ? "#F97316" : "#009EE0"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detail table */}
      <div className="card">
        <p className="section-title">Full Parameter Comparison</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-danone-gray-500 border-b border-danone-gray-700">
              <th className="text-left py-2 font-medium">Parameter</th>
              <th className="text-right py-2 font-medium">Baseline</th>
              <th className="text-right py-2 font-medium">Simulated</th>
              <th className="text-right py-2 font-medium">Delta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-danone-gray-700/40">
            {[
              { param: "Fat %", base: result.baseline.fat_pct, sim: result.simulated.fat_pct, unit: "%" },
              { param: "Protein %", base: result.baseline.protein_pct, sim: result.simulated.protein_pct, unit: "%" },
              { param: "Viscosity (cP)", base: result.baseline.viscosity_cp, sim: result.simulated.viscosity_cp, unit: " cP" },
              { param: "Energy (kWh)", base: result.baseline.energy_kwh, sim: result.simulated.energy_kwh, unit: " kWh" },
              { param: "CO₂ (kg)", base: result.baseline.co2_kg, sim: result.simulated.co2_kg, unit: " kg" },
              { param: "Quality Score", base: result.baseline.quality_score, sim: result.simulated.quality_score, unit: " pts" },
            ].map(({ param, base, sim, unit }) => {
              const delta = sim - base;
              const color = delta === 0 ? "#64748B" : Math.abs(delta) < 0.01 ? "#64748B" : "#E2E8F0";
              return (
                <tr key={param} className="hover:bg-danone-gray-700/30 transition-colors">
                  <td className="py-2 text-danone-gray-300">{param}</td>
                  <td className="py-2 text-right text-danone-gray-400 font-mono">{fmt(base, 2)}{unit}</td>
                  <td className="py-2 text-right text-white font-mono font-semibold">{fmt(sim, 2)}{unit}</td>
                  <td className="py-2 text-right font-mono text-xs" style={{ color }}>
                    {delta >= 0 ? "+" : ""}{fmt(delta, 2)}{unit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SimulatorPage() {
  const [batches, setBatches] = useState<{ batch_id: string; plant_id: string; avg_fat_pct: number; avg_protein_pct: number }[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [fatDelta, setFatDelta] = useState(0.0);
  const [proteinDelta, setProteinDelta] = useState(0.0);
  const [heatSetting, setHeatSetting] = useState(72.0);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSimulatableBatches().then((data) => {
      setBatches(data);
      if (data.length > 0) setSelectedBatch(data[0].batch_id);
    });
  }, []);

  function reset() {
    setFatDelta(0);
    setProteinDelta(0);
    setHeatSetting(72);
    setResult(null);
    setError(null);
  }

  async function simulate() {
    if (!selectedBatch) return;
    setRunning(true);
    setError(null);
    try {
      const res = await runSimulation({
        batch_id: selectedBatch,
        fat_delta_pct: fatDelta,
        protein_delta_pct: proteinDelta,
        heat_setting_c: heatSetting,
      });
      setResult(res);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  const selectedInfo = batches.find((b) => b.batch_id === selectedBatch);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <FlaskConical size={20} className="text-purple-400" />
          What-If Simulation Engine
        </h2>
        <p className="text-xs text-danone-gray-500 mt-1">
          Model the bio-mechanical trade-off: change milk composition and pasteurizer settings,
          see the impact on energy, quality, and carbon footprint instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Controls ────────────────────────────────────────────────────────── */}
        <div data-tour="simulator-controls" className="space-y-5">
          {/* Batch selector */}
          <div className="card space-y-3">
            <p className="section-title">1. Select Reference Batch</p>
            <div className="relative">
              <select
                value={selectedBatch}
                onChange={(e) => { setSelectedBatch(e.target.value); setResult(null); }}
                className="w-full appearance-none bg-danone-gray-700 border border-danone-gray-600 rounded-lg px-3 py-2.5
                           text-sm text-white focus:outline-none focus:border-danone-lightblue transition-colors pr-8"
              >
                {batches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    {b.batch_id} · Plant {b.plant_id} · Fat {fmt(b.avg_fat_pct, 2)}% · Pro {fmt(b.avg_protein_pct, 2)}%
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-danone-gray-400 pointer-events-none" />
            </div>
            {selectedInfo && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="card-sm">
                  <p className="text-danone-gray-500 mb-0.5">Baseline Fat</p>
                  <p className="text-white font-semibold">{fmt(selectedInfo.avg_fat_pct, 2)}%</p>
                </div>
                <div className="card-sm">
                  <p className="text-danone-gray-500 mb-0.5">Baseline Protein</p>
                  <p className="text-white font-semibold">{fmt(selectedInfo.avg_protein_pct, 2)}%</p>
                </div>
              </div>
            )}
          </div>

          {/* Biological inputs */}
          <div className="card space-y-5">
            <p className="section-title">2. Biological Twin — Milk Composition Change</p>
            <Slider
              label="Fat % Delta"
              value={fatDelta}
              min={-1.0}
              max={1.0}
              step={0.1}
              unit="%"
              onChange={setFatDelta}
              description="Higher fat → richer texture, but more centrifuge energy and CO₂"
            />
            <Slider
              label="Protein % Delta"
              value={proteinDelta}
              min={-1.0}
              max={1.0}
              step={0.1}
              unit="%"
              onChange={setProteinDelta}
              description="Higher protein → increased viscosity → more spray dryer pressure"
            />
          </div>

          {/* Mechanical input */}
          <div className="card space-y-5">
            <p className="section-title">3. Mechanical Twin — Pasteurizer Heat Setting</p>
            <Slider
              label="Pasteurizer Temperature"
              value={heatSetting}
              min={60}
              max={95}
              step={1}
              unit="°C"
              onChange={setHeatSetting}
              description="HTST baseline: 72°C. Higher temp → better kill + texture, higher steam energy"
            />
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {[
                { label: "Low (LTLT)", temp: 63, color: "#3B82F6" },
                { label: "HTST", temp: 72, color: "#10B981" },
                { label: "UHT", temp: 90, color: "#F97316" },
              ].map(({ label, temp, color }) => (
                <button
                  key={label}
                  onClick={() => setHeatSetting(temp)}
                  className="py-1.5 rounded-lg border transition-all text-[10px] font-medium"
                  style={{
                    borderColor: heatSetting === temp ? color : "#334155",
                    background: heatSetting === temp ? `${color}20` : "transparent",
                    color: heatSetting === temp ? color : "#94A3B8",
                  }}
                >
                  {label}
                  <br />
                  {temp}°C
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={simulate}
              disabled={running || !selectedBatch}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {running ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play size={14} />
                  Run Simulation
                </>
              )}
            </button>
            <button onClick={reset} className="btn-ghost flex items-center gap-2">
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* ── Results ─────────────────────────────────────────────────────────── */}
        <div ref={resultRef}>
          {result ? (
            <ResultPanel result={result} />
          ) : (
            <div className="card h-full flex flex-col items-center justify-center text-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-danone-gray-700 flex items-center justify-center text-3xl">
                🧪
              </div>
              <div>
                <p className="text-sm font-semibold text-danone-gray-300">Ready to Simulate</p>
                <p className="text-xs text-danone-gray-500 mt-1 max-w-xs">
                  Adjust the biological and mechanical parameters on the left, then click "Run Simulation"
                  to see how the changes affect energy, quality, and CO₂.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
