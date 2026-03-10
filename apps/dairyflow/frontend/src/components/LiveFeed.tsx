import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { useSSE } from "../hooks/useSSE";
import { useMemo } from "react";
import { cn } from "../lib/utils";
import type { SensorEvent } from "../lib/types";

// ─── Aggregated data point per second across all equipment ───────────────────
interface ChartPoint {
  t: string;           // display label
  temp: number | null;
  energy: number | null;
  moisture: number | null;
  flow: number | null;
}

function aggregateToPoints(events: SensorEvent[]): ChartPoint[] {
  // Group by second bucket
  const buckets = new Map<string, SensorEvent[]>();
  for (const ev of events) {
    const bucket = ev.event_ts?.slice(0, 19) ?? ""; // truncate to seconds
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(ev);
  }

  const sorted = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));

  return sorted.map(([ts, evs]) => {
    const temps = evs.map((e) => e.temperature_c).filter((v): v is number => v != null);
    const energies = evs.map((e) => e.energy_kwh).filter((v): v is number => v != null);
    const moistures = evs.map((e) => e.moisture_pct).filter((v): v is number => v != null);
    const flows = evs.map((e) => e.flow_rate_lph).filter((v): v is number => v != null);

    const avg = (arr: number[]) =>
      arr.length ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : null;

    let label = ts;
    try {
      label = format(parseISO(ts), "HH:mm:ss");
    } catch {
      label = ts.slice(11, 19);
    }

    return {
      t: label,
      temp: avg(temps),
      energy: avg(energies),
      moisture: avg(moistures),
      flow: avg(flows),
    };
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, rate }: { status: string; rate: number }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          status === "live"
            ? "bg-emerald-400 animate-pulse-live"
            : status === "connecting"
            ? "bg-yellow-400 animate-pulse"
            : "bg-red-400"
        )}
      />
      <span
        className={cn(
          "text-xs font-mono font-semibold",
          status === "live" ? "text-emerald-400" : "text-danone-gray-400"
        )}
      >
        {status === "live" ? "LIVE" : status === "connecting" ? "CONNECTING…" : "RECONNECTING…"}
      </span>
      {status === "live" && rate > 0 && (
        <span className="text-[11px] text-danone-gray-500 font-mono">{rate} evt/s</span>
      )}
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: {color: string; name: string; value: number}[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-sm text-xs space-y-1 min-w-[140px]">
      <p className="text-danone-gray-400 font-mono mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-danone-gray-300">{p.name}:</span>
          <span className="text-white font-medium ml-auto">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Recent events table ───────────────────────────────────────────────────────
function EventTable({ events }: { events: SensorEvent[] }) {
  const recent = [...events].reverse().slice(0, 8);
  return (
    <div className="overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-danone-gray-500 border-b border-danone-gray-700">
            <th className="text-left pb-2 font-medium">Time</th>
            <th className="text-left pb-2 font-medium">Equipment</th>
            <th className="text-right pb-2 font-medium">Temp °C</th>
            <th className="text-right pb-2 font-medium">Energy kWh</th>
            <th className="text-right pb-2 font-medium">Moisture</th>
            <th className="text-left pb-2 font-medium pl-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-danone-gray-700/50">
          {recent.map((ev, i) => (
            <tr key={i} className="hover:bg-danone-gray-700/30 transition-colors">
              <td className="py-1.5 font-mono text-danone-gray-400">
                {ev.event_ts?.slice(11, 19) ?? "—"}
              </td>
              <td className="py-1.5 text-danone-gray-300 max-w-[140px] truncate pr-2">
                {ev.equipment_name}
              </td>
              <td className="py-1.5 text-right text-white">{ev.temperature_c?.toFixed(1) ?? "—"}</td>
              <td className="py-1.5 text-right text-white">{ev.energy_kwh?.toFixed(3) ?? "—"}</td>
              <td className="py-1.5 text-right text-white">
                {ev.moisture_pct != null ? `${ev.moisture_pct.toFixed(2)}%` : "—"}
              </td>
              <td className="py-1.5 pl-3">
                {ev.alarm_code ? (
                  <span className="badge badge-alarm">{ev.alarm_code}</span>
                ) : ev.moisture_ok === false ? (
                  <span className="badge badge-warning">OOB</span>
                ) : (
                  <span className="badge badge-ok">OK</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LiveFeed() {
  const { events, status, lastTs, eventRate } = useSSE("/api/stream");

  const chartData = useMemo(() => aggregateToPoints(events), [events]);

  return (
    <div className="card space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Live Sensor Feed</h2>
          <p className="text-xs text-danone-gray-500 mt-0.5">
            silver_twin_events · rolling 2-minute window
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastTs && (
            <span className="text-[11px] font-mono text-danone-gray-500">
              {lastTs.slice(11, 19)} UTC
            </span>
          )}
          <StatusBadge status={status} rate={eventRate} />
        </div>
      </div>

      {/* Chart */}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
            <XAxis
              dataKey="t"
              tick={{ fontSize: 10, fill: "#64748B", fontFamily: "JetBrains Mono" }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="temp"
              tick={{ fontSize: 10, fill: "#64748B" }}
              tickLine={false}
              axisLine={false}
              width={38}
              domain={["auto", "auto"]}
            />
            <YAxis
              yAxisId="energy"
              orientation="right"
              tick={{ fontSize: 10, fill: "#64748B" }}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#94A3B8", paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              name="Temp (°C)"
              stroke="#F97316"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="energy"
              type="monotone"
              dataKey="energy"
              name="Energy (kWh)"
              stroke="#009EE0"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="moisture"
              name="Moisture (%)"
              stroke="#10B981"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Event table */}
      <div>
        <p className="section-title">Latest Events</p>
        {events.length === 0 ? (
          <p className="text-xs text-danone-gray-500 py-4 text-center">
            {status === "connecting" ? "Connecting to stream…" : "Awaiting sensor events…"}
          </p>
        ) : (
          <EventTable events={events} />
        )}
      </div>
    </div>
  );
}
