// ─── Equipment ────────────────────────────────────────────────────────────────

export interface EquipmentMetric {
  equipment_id: string;
  equipment_name: string;
  equipment_type: string;
  plant_id: string;
  line_id: string;
  window_5min: string;
  avg_temperature_c: number;
  max_temperature_c: number;
  total_energy_kwh: number;
  avg_flow_rate_lph: number;
  alarm_count: number;
  event_count: number;
}

export interface EquipmentReference {
  equipment_id: string;
  equipment_name: string;
  equipment_type: string;
  plant_id: string;
  line_id: string;
  location: string;
  capacity_lph: number;
  install_year: number;
}

// ─── Batches ──────────────────────────────────────────────────────────────────

export interface BatchYield {
  batch_id: string;
  plant_id: string;
  line_id: string;
  batch_first_seen: string;
  batch_last_seen: string;
  avg_moisture_pct: number;
  moisture_compliance_pct: number;
  avg_viscosity_cp: number;
  avg_protein_pct: number;
  avg_fat_pct: number;
  ftr_rate_pct: number;
  total_energy_kwh: number;
  event_count: number;
}

export interface BatchReference {
  batch_id: string;
  [key: string]: unknown;
}

// ─── Sustainability ────────────────────────────────────────────────────────────

export interface SustainabilityRow {
  plant_id: string;
  line_id: string;
  hour_bucket: string;
  total_energy_kwh: number;
  cip_water_liters: number;
  total_water_liters: number;
  estimated_co2_kg: number;
  water_alarm_count: number;
  event_count: number;
}

export interface SustainabilitySummary {
  plant_id: string;
  total_energy_kwh: number;
  total_water_liters: number;
  cip_water_liters: number;
  estimated_co2_kg: number;
  water_alarm_count: number;
}

export interface BatchCarbonRow extends BatchYield {
  estimated_co2_kg: number;
  co2_vs_avg_pct: number;
}

// ─── Knowledge Graph ──────────────────────────────────────────────────────────

export type NodeStatus = "ok" | "warning" | "alarm";

export interface GraphNodeMetrics {
  avg_temperature_c?: number;
  total_energy_kwh?: number;
  alarm_count?: number;
  avg_moisture_pct?: number;
  avg_protein_pct?: number;
  avg_fat_pct?: number;
  ftr_rate_pct?: number;
  moisture_compliance_pct?: number;
}

export interface GraphNode {
  id: string;
  type: "equipment" | "batch";
  label: string;
  equipment_type?: string;
  plant_id: string;
  line_id: string;
  metrics: GraphNodeMetrics;
  status: NodeStatus;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  event_count: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Live Stream ──────────────────────────────────────────────────────────────

export interface SensorEvent {
  event_ts: string;
  event_type: string;
  equipment_id: string;
  equipment_name: string;
  equipment_type: string;
  plant_id: string;
  line_id: string;
  batch_id: string;
  temperature_c: number | null;
  moisture_pct: number | null;
  energy_kwh: number | null;
  flow_rate_lph: number | null;
  ph_level: number | null;
  viscosity_cp: number | null;
  pressure_bar: number | null;
  alarm_code: string | null;
  moisture_ok: boolean | null;
}

export interface StreamPayload {
  events: SensorEvent[];
  ts: string;
}

// ─── Simulation ───────────────────────────────────────────────────────────────

export interface SimulationRequest {
  batch_id: string;
  fat_delta_pct: number;
  protein_delta_pct: number;
  heat_setting_c: number;
}

export interface SimulationResult {
  batch_id: string;
  inputs: {
    fat_delta_pct: number;
    protein_delta_pct: number;
    heat_setting_c: number;
  };
  baseline: {
    fat_pct: number;
    protein_pct: number;
    viscosity_cp: number;
    energy_kwh: number;
    co2_kg: number;
    quality_score: number;
    ftr_rate_pct: number;
  };
  simulated: {
    fat_pct: number;
    protein_pct: number;
    viscosity_cp: number;
    energy_kwh: number;
    co2_kg: number;
    quality_score: number;
  };
  deltas: {
    energy_kwh: number;
    energy_pct: number;
    co2_kg: number;
    quality_score: number;
  };
  recommendation: string;
}
