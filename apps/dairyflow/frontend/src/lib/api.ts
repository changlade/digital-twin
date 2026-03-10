import type {
  BatchCarbonRow,
  BatchYield,
  EquipmentMetric,
  EquipmentReference,
  GraphData,
  SimulationRequest,
  SimulationResult,
  SustainabilityRow,
  SustainabilitySummary,
} from "./types";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

// ─── Equipment ────────────────────────────────────────────────────────────────
export const fetchEquipmentMetrics = () =>
  get<{ data: EquipmentMetric[] }>("/equipment-metrics").then((r) => r.data);

export const fetchEquipmentReference = () =>
  get<{ data: EquipmentReference[] }>("/equipment-reference").then((r) => r.data);

export const fetchEquipmentHistory = (id: string, hours = 1) =>
  get<{ equipment_id: string; data: EquipmentMetric[] }>(
    `/equipment-history/${id}?hours=${hours}`
  ).then((r) => r.data);

// ─── Batches ──────────────────────────────────────────────────────────────────
export const fetchBatchYield = () =>
  get<{ data: BatchYield[] }>("/batch-yield").then((r) => r.data);

// ─── Sustainability ────────────────────────────────────────────────────────────
export const fetchSustainability = (hours = 24) =>
  get<{ data: SustainabilityRow[] }>(`/sustainability?hours=${hours}`).then(
    (r) => r.data
  );

export const fetchSustainabilitySummary = () =>
  get<{ data: SustainabilitySummary[] }>("/sustainability-summary").then(
    (r) => r.data
  );

export const fetchBatchCarbonTraceback = () =>
  get<{ data: BatchCarbonRow[]; emission_factor: number }>(
    "/batch-carbon-traceback"
  );

// ─── Graph ────────────────────────────────────────────────────────────────────
export const fetchGraph = () => get<GraphData>("/graph");

// ─── Simulation ───────────────────────────────────────────────────────────────
export const fetchSimulatableBatches = () =>
  get<{ data: { batch_id: string; plant_id: string; avg_fat_pct: number; avg_protein_pct: number; ftr_rate_pct: number }[] }>(
    "/simulate/batches"
  ).then((r) => r.data);

export const runSimulation = (req: SimulationRequest) =>
  post<SimulationResult>("/simulate", req);
