import { Thermometer, Zap, AlertTriangle, Activity } from "lucide-react";
import type { EquipmentMetric } from "../lib/types";
import { cn, equipmentTypeColor, equipmentTypeIcon, fmt, fmtKwh } from "../lib/utils";

interface EquipmentGridProps {
  equipment: EquipmentMetric[];
  loading: boolean;
}

function statusClass(e: EquipmentMetric) {
  if (e.alarm_count > 0) return "border-red-500/40 bg-red-500/5";
  if ((e.avg_temperature_c ?? 0) > 85) return "border-yellow-500/40 bg-yellow-500/5";
  return "border-danone-gray-700";
}

function EquipmentCard({ eq }: { eq: EquipmentMetric }) {
  const color = equipmentTypeColor(eq.equipment_type);
  const icon = equipmentTypeIcon(eq.equipment_type);
  const hasAlarm = eq.alarm_count > 0;
  const isWarm = (eq.avg_temperature_c ?? 0) > 85;

  return (
    <div className={cn("card-sm flex flex-col gap-3 border", statusClass(eq))}>
      {/* Header row */}
      <div className="flex items-center justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0"
            style={{ background: `${color}20`, color }}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{eq.equipment_name}</p>
            <p className="text-[10px] text-danone-gray-500 truncate">
              {eq.equipment_type} · L{eq.line_id} · P{eq.plant_id}
            </p>
          </div>
        </div>
        {hasAlarm ? (
          <span className="badge badge-alarm shrink-0">
            <AlertTriangle size={10} /> {eq.alarm_count}
          </span>
        ) : isWarm ? (
          <span className="badge badge-warning shrink-0">WARM</span>
        ) : (
          <span className="badge badge-ok shrink-0">OK</span>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Thermometer size={11} className="text-orange-400" />
            <span className="text-[10px] text-danone-gray-500">Temp</span>
          </div>
          <p className="text-sm font-bold text-white">{fmt(eq.avg_temperature_c)}°C</p>
        </div>
        <div className="text-center border-x border-danone-gray-700">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Zap size={11} className="text-danone-lightblue" />
            <span className="text-[10px] text-danone-gray-500">Energy</span>
          </div>
          <p className="text-sm font-bold text-white">{fmtKwh(eq.total_energy_kwh)}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Activity size={11} className="text-purple-400" />
            <span className="text-[10px] text-danone-gray-500">Events</span>
          </div>
          <p className="text-sm font-bold text-white">{eq.event_count ?? 0}</p>
        </div>
      </div>

      {/* Flow rate bar */}
      <div>
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-danone-gray-500">Flow rate</span>
          <span className="text-danone-gray-300">{fmt(eq.avg_flow_rate_lph, 0)} L/h</span>
        </div>
        <div className="h-1 bg-danone-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, ((eq.avg_flow_rate_lph ?? 0) / 5000) * 100)}%`,
              background: color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function EquipmentGrid({ equipment, loading }: EquipmentGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card-sm h-36 bg-danone-gray-700 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!equipment.length) {
    return (
      <div className="card text-center py-10">
        <p className="text-danone-gray-500 text-sm">No equipment data available.</p>
        <p className="text-danone-gray-600 text-xs mt-1">Start the event generator to see live metrics.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {equipment.map((eq) => (
        <EquipmentCard key={eq.equipment_id} eq={eq} />
      ))}
    </div>
  );
}
