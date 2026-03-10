export type TourPosition = "top" | "bottom" | "left" | "right";

export interface TourStep {
  id: string;
  route: string;
  title: string;
  description: string;
  businessFocus: string;
  position?: TourPosition;
}

export const introStep = {
  id: "intro",
  route: "/",
};

export const tourSteps: TourStep[] = [
  {
    id: "intro",
    route: "/",
    title: "DairyFlow — Bio-Mechanical Digital Twin",
    description:
      "DairyFlow is a real-time Decision Intelligence platform built on Databricks that connects raw milk biology to factory machine performance in a single operational view. It gives manufacturing executives and plant managers live intelligence to run more efficient, higher-quality, and more sustainable dairy operations — without waiting for end-of-shift reports.",
    businessFocus:
      "Reduce unplanned downtime, improve First Time Right rates, lower energy cost, and hit sustainability targets — all from one live platform.",
  },
  {
    id: "kpi-cards",
    route: "/",
    title: "Real-Time Production KPIs",
    description:
      "Five critical metrics refresh every 30 seconds straight from Databricks gold-layer aggregated tables: average equipment temperature, total energy consumed in the last 5-minute window, active alarm count, First Time Right rate, and moisture compliance across all active batches.",
    businessFocus:
      "Are my FTR rates above target? Do I have active alarms that need an immediate response on the floor?",
    position: "bottom",
  },
  {
    id: "live-feed",
    route: "/",
    title: "1-Second Live Sensor Stream",
    description:
      "This chart streams raw sensor events from the Databricks Lakeflow pipeline at 3 events per second via Server-Sent Events (SSE). Temperature, moisture, energy, and flow readings land on the screen with sub-second latency — no manual refresh, no polling delay.",
    businessFocus:
      "What is happening on the factory floor right now — before a shift report is even compiled?",
    position: "bottom",
  },
  {
    id: "equipment-grid",
    route: "/",
    title: "Mechanical Twin — Equipment Status",
    description:
      "Each card represents a physical machine: Centrifuges, Pasteurizers, Spray Dryers, Mixing Tanks, and CIP Units. Colour coding signals health instantly — green is nominal, yellow is a warning, red is an active alarm requiring intervention. Average temperature and total energy per machine are shown in the current 5-minute window.",
    businessFocus:
      "Which piece of equipment needs attention right now — before it causes a batch failure or unplanned downtime?",
    position: "top",
  },
  {
    id: "batch-table",
    route: "/",
    title: "Biological Twin — Batch Quality",
    description:
      "Every active production batch is listed with its full composition profile: moisture %, viscosity (cP), protein %, fat %, First Time Right rate, and energy consumed. Compliance badges flag batches outside acceptable ranges in amber or red so operators know which batches to prioritise.",
    businessFocus:
      "Are all batches meeting product specification across every plant and line — without waiting for end-of-shift lab results?",
    position: "top",
  },
  {
    id: "knowledge-graph",
    route: "/graph",
    title: "Bio-Mechanical Knowledge Graph",
    description:
      "This interactive graph links the biological twin (milk batches — round nodes) to the mechanical twin (factory equipment — square nodes). Edges represent live 'processed_by' relationships derived from streaming sensor events. Node borders signal status: green = OK, yellow = warning, red = active alarm. Click any node for details.",
    businessFocus:
      "When a piece of equipment is in alarm, which batches were processed through it? What were their fat % and protein % at the time?",
    position: "bottom",
  },
  {
    id: "sustainability-kpis",
    route: "/sustainability",
    title: "Sustainability KPIs",
    description:
      "Four sustainability metrics tracked in real time across all plants: estimated CO₂ footprint (using EU grid emission factor 0.233 kgCO₂/kWh), total energy consumed, total water including CIP-only water, and energy intensity in kWh per kilolitre. A target threshold of ≤ 2.5 kWh/kL is tracked and colour-coded.",
    businessFocus:
      "Are we on track for our energy intensity and CO₂ reduction commitments — at this moment, not at month-end?",
    position: "bottom",
  },
  {
    id: "carbon-traceback",
    route: "/sustainability",
    title: "Per-Batch CO₂ Traceback",
    description:
      "Every batch is ranked by estimated carbon footprint and compared to the plant average. Batches more than 10% above average are flagged red. An automated insight explains the root cause: e.g. higher fat % drove more spray-dryer and centrifuge energy, which amplified CO₂ output. The plant-level breakdown lets you compare sites side-by-side.",
    businessFocus:
      "Which batch is driving the highest carbon footprint this shift, and what biological or process variable caused it?",
    position: "top",
  },
  {
    id: "simulator-controls",
    route: "/simulator",
    title: "What-If Simulation Engine",
    description:
      "Select any real production batch as a baseline. Then adjust three parameters: fat % delta (±1%), protein % delta (±1%), and pasteurizer temperature (60–95°C with LTLT / HTST / UHT presets). The bio-mechanical model instantly computes the resulting energy delta (kWh), CO₂ delta (kg), quality score change, and viscosity change — all grounded in the actual batch data from Databricks.",
    businessFocus:
      "If this morning's milk delivery comes in 0.3% higher in protein, what does that mean for energy cost and product quality score — before we accept the delivery?",
    position: "right",
  },
  {
    id: "simulator-controls",
    route: "/simulator",
    title: "Reading the Recommendation",
    description:
      "After running a simulation, a plain-language recommendation appears: 'Optimal: lower energy with maintained quality', 'Caution: significant energy cost increase — consider reducing heat setting', or 'Quality degraded below threshold — adjust protein or heat setting'. A radar chart compares baseline vs. simulated profiles across five dimensions simultaneously.",
    businessFocus:
      "What is the right process setting for this batch — and what is the trade-off between quality, energy cost, and carbon footprint if we change it?",
    position: "right",
  },
];
