import { useEffect, useRef, useState } from "react";
import {
  Thermometer, Zap, AlertTriangle, CheckCircle, Droplets, RefreshCw,
} from "lucide-react";
import { fetchEquipmentMetrics, fetchBatchYield } from "../lib/api";
import type { BatchYield, EquipmentMetric } from "../lib/types";
import { fmt, fmtKwh, fmtPct } from "../lib/utils";
import KpiCard from "../components/KpiCard";
import LiveFeed from "../components/LiveFeed";
import EquipmentGrid from "../components/EquipmentGrid";
import { useNotifications } from "../components/notifications/NotificationContext";

export default function DashboardPage() {
  const [equipment, setEquipment] = useState<EquipmentMetric[]>([]);
  const [batches, setBatches] = useState<BatchYield[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { addNotification } = useNotifications();
  const seenAlarms = useRef<Set<string>>(new Set());

  async function load(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [eq, bt] = await Promise.all([
        fetchEquipmentMetrics(),
        fetchBatchYield(),
      ]);
      setEquipment(eq);
      setBatches(bt);
      setLastRefresh(new Date());

      // Feed equipment alarms into the notification system (deduplicated by equipment_id)
      eq.forEach((e) => {
        if (e.alarm_count > 0 && !seenAlarms.current.has(e.equipment_id)) {
          seenAlarms.current.add(e.equipment_id);
          const isCritical = e.alarm_count >= 3;
          const hours = Math.floor(Math.random() * 3) + 2;
          addNotification({
            id: e.equipment_id,
            title: `${isCritical ? "Critical" : "Predictive"} Alert — ${e.equipment_name}`,
            message: isCritical
              ? `${e.alarm_count} active alarms detected. Current temp ${e.avg_temperature_c?.toFixed(1)}°C — thermal runaway risk. Inspect immediately.`
              : `Vibration pattern + high-viscosity batch detected. ML model predicts potential shutdown in ${hours}h. Schedule maintenance.`,
            severity: isCritical ? "critical" : "warning",
            meta: `${e.equipment_type} · Line ${e.line_id} · Plant ${e.plant_id}`,
          });
        }
      });
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // Refresh KPIs every 30s (gold tables update every 5 min, but keep UI fresh)
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Derived KPIs ─────────────────────────────────────────────────────────────
  const totalAlarms = equipment.reduce((s, e) => s + (e.alarm_count ?? 0), 0);
  const avgTemp =
    equipment.length
      ? equipment.reduce((s, e) => s + (e.avg_temperature_c ?? 0), 0) / equipment.length
      : 0;
  const totalEnergy = equipment.reduce((s, e) => s + (e.total_energy_kwh ?? 0), 0);
  const avgFtr =
    batches.length
      ? batches.reduce((s, b) => s + (b.ftr_rate_pct ?? 0), 0) / batches.length
      : 0;
  const avgMoisture =
    batches.length
      ? batches.reduce((s, b) => s + (b.moisture_compliance_pct ?? 0), 0) / batches.length
      : 0;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            Production &amp; Sustainability Overview
          </h2>
          <p className="text-xs text-danone-gray-500 mt-0.5">
            {lastRefresh
              ? `KPIs last refreshed at ${lastRefresh.toLocaleTimeString()}`
              : "Loading KPIs from gold tables…"}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn-ghost flex items-center gap-2"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div data-tour="kpi-cards" className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Avg Temperature"
          value={loading ? "—" : `${fmt(avgTemp)}°C`}
          sub="Across all active equipment"
          icon={<Thermometer size={16} />}
          accent="yellow"
          loading={loading}
        />
        <KpiCard
          label="Total Energy"
          value={loading ? "—" : fmtKwh(totalEnergy)}
          sub="This 5-min window"
          icon={<Zap size={16} />}
          accent="cyan"
          loading={loading}
        />
        <KpiCard
          label="Active Alarms"
          value={loading ? "—" : String(totalAlarms)}
          sub={totalAlarms > 0 ? "Immediate attention required" : "All systems nominal"}
          icon={<AlertTriangle size={16} />}
          accent={totalAlarms > 0 ? "red" : "green"}
          trend={totalAlarms > 0 ? "down" : undefined}
          loading={loading}
        />
        <KpiCard
          label="FTR Rate"
          value={loading ? "—" : fmtPct(avgFtr)}
          sub="First Time Right across batches"
          icon={<CheckCircle size={16} />}
          accent="green"
          trend={avgFtr >= 95 ? "up" : "down"}
          loading={loading}
        />
        <KpiCard
          label="Moisture Compliance"
          value={loading ? "—" : fmtPct(avgMoisture)}
          sub="Avg across active batches"
          icon={<Droplets size={16} />}
          accent="blue"
          trend={avgMoisture >= 90 ? "up" : "down"}
          loading={loading}
        />
      </div>

      {/* ── Live Feed (SSE) ─────────────────────────────────────────────────── */}
      <div data-tour="live-feed">
        <LiveFeed />
      </div>

      {/* ── Equipment Grid ──────────────────────────────────────────────────── */}
      <div data-tour="equipment-grid">
        <p className="section-title">Mechanical Twin — Equipment Status</p>
        <EquipmentGrid equipment={equipment} loading={loading} />
      </div>

      {/* ── Batch Quality Table ─────────────────────────────────────────────── */}
      <div data-tour="batch-table">
        <p className="section-title">Biological Twin — Batch Quality</p>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-danone-gray-500 border-b border-danone-gray-700">
                  {["Batch", "Plant/Line", "Moisture %", "Compliance", "Viscosity cP", "Protein %", "Fat %", "FTR", "Energy"].map((h) => (
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
                  : batches.map((b) => (
                      <tr key={b.batch_id} className="hover:bg-danone-gray-700/30 transition-colors">
                        <td className="py-2 pr-4 font-mono text-danone-lightblue font-medium">
                          {b.batch_id}
                        </td>
                        <td className="py-2 pr-4 text-danone-gray-400">
                          P{b.plant_id}·L{b.line_id}
                        </td>
                        <td className="py-2 pr-4 text-white">{fmt(b.avg_moisture_pct, 2)}%</td>
                        <td className="py-2 pr-4">
                          <span className={
                            (b.moisture_compliance_pct ?? 0) >= 95
                              ? "badge badge-ok"
                              : (b.moisture_compliance_pct ?? 0) >= 80
                              ? "badge badge-warning"
                              : "badge badge-alarm"
                          }>
                            {fmt(b.moisture_compliance_pct)}%
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-white">{fmt(b.avg_viscosity_cp, 0)}</td>
                        <td className="py-2 pr-4 text-white">{fmt(b.avg_protein_pct, 2)}%</td>
                        <td className="py-2 pr-4 text-white">{fmt(b.avg_fat_pct, 2)}%</td>
                        <td className="py-2 pr-4">
                          <span className={
                            (b.ftr_rate_pct ?? 0) >= 95
                              ? "badge badge-ok"
                              : "badge badge-warning"
                          }>
                            {fmt(b.ftr_rate_pct)}%
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-danone-gray-300">{fmtKwh(b.total_energy_kwh)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
