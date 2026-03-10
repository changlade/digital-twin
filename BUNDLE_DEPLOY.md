# Danone Digital Twin – Demo Deployment Guide

Bio-Mechanical Yield & Sustainability Digital Twin showcasing **Databricks streaming ingestion** and **Lakeflow Spark Declarative Pipeline** capabilities with synthetic Danone factory data.

## What's in the Bundle

| Resource | Name in Workspace | Description |
|----------|-------------------|-------------|
| **Pipeline** | `[dev] Danone Digital Twin ETL` | Lakeflow pipeline: bronze → silver → gold |
| **Job: Generator** | `[dev] Danone Twin - Event Generator` | Writes sensor JSON events every second to the volume |
| **Job: Setup** | `[dev] Danone Twin - Setup (run once)` | One-time setup via Databricks (wraps the local script) |

### Tables Created

| Table | Type | Description |
|-------|------|-------------|
| `bronze_twin_events` | Streaming Table | Raw events from volume via Auto Loader |
| `silver_twin_events` | Streaming Table | Enriched + filtered events with quality flags |
| `gold_equipment_metrics` | Materialized View | KPIs per equipment × 5-min window (temperature, energy, alarms) |
| `gold_batch_yield` | Materialized View | Per-batch quality (moisture, viscosity, protein/fat), FTR rate |
| `gold_sustainability_hourly` | Materialized View | Hourly water/energy/CO₂ by plant and line (Circular Water Twin) |
| `equipment` | Delta Table | Reference: 20 pieces of equipment across 2 plants |
| `raw_material_batches` | Delta Table | Reference: 15 synthetic milk/formula batches |

All tables land in `danonedemo_catalog.digital_twin`.

---

## Prerequisites

- Databricks CLI installed and authenticated (`DEFAULT` profile → `https://fevm-danonedemo.cloud.databricks.com`)
- Python 3.11+ with `databricks-sdk` installed (`pip install databricks-sdk`)

---

## First-Time Setup (run once per environment)

From the `danone-digital-twin/` directory:

```bash
# 1. Deploy the bundle (uploads files + creates pipeline and jobs in workspace)
databricks bundle deploy --profile DEFAULT

# 2. Run the local setup script (creates schema/volume, loads reference data, seeds 20 event files)
python scripts/setup_demo_local.py
```

The setup script will:
- Create `danonedemo_catalog.digital_twin` schema
- Create `twin_landing` Unity Catalog volume
- Upload `equipment.csv` and `raw_material_batches.csv` to the volume
- Create Delta tables `equipment` and `raw_material_batches`
- Seed 20 initial JSON event files so the pipeline has data immediately

---

## Demo Flow (on presentation day)

### Step 1 – Start the event generator

```bash
databricks bundle run danone_twin_event_generator --profile DEFAULT
```

Or in the Databricks UI: **Workflows → Jobs → `[dev] Danone Twin - Event Generator` → Run now**

This writes **10 sensor events per second** as individual JSON files to:
```
/Volumes/danonedemo_catalog/digital_twin/twin_landing/streaming_events/
```

For a 10-minute demo, the generator produces ~600 files (~6,000 events).

### Step 2 – Start the Lakeflow pipeline (continuous mode)

```bash
databricks bundle run danone_twin_etl --profile DEFAULT
```

Or in the Databricks UI: **Delta Live Tables → `[dev] Danone Digital Twin ETL` → Start**

The pipeline runs in **continuous mode** — it stays running and picks up new files from the volume as soon as the generator writes them (typically within 1–2 seconds). Watch the pipeline DAG in the UI update live:
1. **Bronze** (`bronze_twin_events`): Auto Loader continuously detects and ingests new JSON files
2. **Silver** (`silver_twin_events`): Enriched stream with moisture quality flags, updated in real time
3. **Gold** (3 tables): Aggregated KPIs refresh continuously as new silver rows arrive

To stop the pipeline: click **Stop** in the UI, or `databricks pipelines stop --pipeline-id 67ab1515-48ef-448d-b7f8-0fa128776947 --profile DEFAULT`.

### Step 3 – Show the data in real time

Query the gold tables while the generator is running and the pipeline is updating:

```sql
-- Equipment operational KPIs (mechanical twin)
SELECT equipment_name, equipment_type, plant_id, window_5min,
       avg_temperature_c, total_energy_kwh, alarm_count
FROM danonedemo_catalog.digital_twin.gold_equipment_metrics
ORDER BY window_5min DESC LIMIT 20;

-- Batch quality (biological twin)
SELECT batch_id, plant_id, avg_moisture_pct, moisture_compliance_pct,
       avg_viscosity_cp, ftr_rate_pct, total_energy_kwh
FROM danonedemo_catalog.digital_twin.gold_batch_yield
ORDER BY batch_first_seen DESC;

-- Sustainability / Circular Water Twin
SELECT plant_id, line_id, hour_bucket, total_energy_kwh,
       cip_water_liters, total_water_liters, estimated_co2_kg, water_alarm_count
FROM danonedemo_catalog.digital_twin.gold_sustainability_hourly
ORDER BY hour_bucket DESC;

-- Raw event stream (to show "transaction table")
SELECT event_ts, event_type, equipment_name, plant_id,
       temperature_c, moisture_pct, energy_kwh, alarm_code
FROM danonedemo_catalog.digital_twin.silver_twin_events
ORDER BY event_ts DESC LIMIT 50;
```

### Demo narrative

- **Streaming ingestion**: "Every second, 17 factories are sending sensor data. Each file arrives here in the volume. Auto Loader picks it up and streams it into `bronze_twin_events` in real time."
- **Lakeflow pipeline**: "The Lakeflow pipeline propagates data through three layers: bronze (raw), silver (cleaned, enriched with quality flags), and gold (KPI aggregations for equipment, batches, and sustainability)."
- **Biological × Mechanical link**: "When moisture goes out of spec (> 5%), the system raises an alarm in silver and it propagates to `gold_equipment_metrics.alarm_count`. We can trace back through the batch to see the inlet temperature that caused it."
- **Circular Water Twin**: "CIP units are the biggest water consumers. `gold_sustainability_hourly.cip_water_liters` tracks this per plant per hour, and water alarms appear when consumption exceeds the threshold — enabling the 'Circular Water' optimization Danone targets."

---

## Redeploying After Code Changes

```bash
cd danone-digital-twin/

# Validate first
databricks bundle validate --profile DEFAULT

# Deploy updated files
databricks bundle deploy --profile DEFAULT

# Re-run pipeline (full refresh resets streaming state)
databricks bundle run danone_twin_etl --profile DEFAULT
```

---

## Project Structure

```
danone-digital-twin/
├── databricks.yml                          # Bundle config (host, variables, targets)
├── BUNDLE_DEPLOY.md                        # This file
├── resources/
│   ├── danone_twin_etl.pipeline.yml        # Lakeflow pipeline resource
│   ├── danone_twin_event_generator.job.yml # Event generator job
│   └── danone_twin_setup.job.yml           # One-time setup job (Databricks-side)
├── src/
│   ├── danone_twin_etl/
│   │   └── transformations/
│   │       ├── bronze_twin_events.sql      # STREAMING TABLE: Auto Loader from volume
│   │       ├── silver_twin_events.sql      # STREAMING TABLE: Enriched events
│   │       ├── gold_equipment_metrics.sql  # MATERIALIZED VIEW: 5-min equipment KPIs
│   │       ├── gold_batch_yield.sql        # MATERIALIZED VIEW: Per-batch quality
│   │       └── gold_sustainability_hourly.sql # MATERIALIZED VIEW: Energy + water KPIs
│   └── generator/
│       ├── event_generator.py              # Core generator logic (reusable module)
│       └── run_generator.py               # Databricks notebook wrapper for the job
├── scripts/
│   ├── setup_demo_local.py                 # Local setup script (run from CLI)
│   └── setup_demo.py                       # Databricks notebook setup (alternative)
└── data/
    ├── equipment.csv                       # 20 pieces of equipment (2 plants, 5 types)
    └── raw_material_batches.csv            # 15 synthetic milk/formula batches
```

---

## Variables

Override at deploy time with `--var`:

```bash
databricks bundle deploy --profile DEFAULT \
  --var="catalog=my_catalog" \
  --var="schema=my_schema" \
  --var="volume_name=my_volume" \
  --var="run_duration_minutes=20"
```

| Variable | Default | Description |
|----------|---------|-------------|
| `catalog` | `danonedemo_catalog` | Unity Catalog name |
| `schema` | `digital_twin` | Schema for all tables |
| `volume_name` | `twin_landing` | Volume for streaming events |
| `warehouse_id` | `50e0bc7f9918a201` | SQL warehouse for setup job |
| `run_duration_minutes` | `10` | Generator run duration |

---

## Demo Reset

To reset the streaming data and run the demo fresh:

```bash
# Clear seeded files and streaming state
python3.11 -c "
from databricks.sdk import WorkspaceClient
w = WorkspaceClient(profile='DEFAULT')
# List and delete files
files = list(w.files.list_directory_contents('/Volumes/danonedemo_catalog/digital_twin/twin_landing/streaming_events'))
for f in files:
    w.files.delete(f.path)
    print(f'Deleted: {f.path}')
print(f'Cleared {len(files)} files.')
"

# Drop and recreate tables
python3.11 -c "
from databricks.sdk import WorkspaceClient
w = WorkspaceClient(profile='DEFAULT')
wh = '50e0bc7f9918a201'
for t in ['bronze_twin_events','silver_twin_events','gold_equipment_metrics','gold_batch_yield','gold_sustainability_hourly']:
    w.statement_execution.execute_statement(warehouse_id=wh, statement=f'DROP TABLE IF EXISTS danonedemo_catalog.digital_twin.{t}', wait_timeout='30s')
    print(f'Dropped: {t}')
"

# Re-seed events
python scripts/setup_demo_local.py

# Restart pipeline
databricks bundle run danone_twin_etl --profile DEFAULT
```

## Workspace Links

- **Pipeline**: https://fevm-danonedemo.cloud.databricks.com/pipelines/67ab1515-48ef-448d-b7f8-0fa128776947
- **Generator job**: https://fevm-danonedemo.cloud.databricks.com/jobs/765791638727704
- **Setup job**: https://fevm-danonedemo.cloud.databricks.com/jobs/250008881976566
