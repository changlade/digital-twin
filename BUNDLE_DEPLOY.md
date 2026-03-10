# Danone Digital Twin — Bundle Deployment Guide

Bio-Mechanical Yield & Sustainability Digital Twin showcasing **Databricks streaming ingestion**, **Lakeflow Spark Declarative Pipelines**, and the **DairyFlow Databricks App** — all deployed from a single Databricks Asset Bundle.

---

## What's in the Bundle

| Resource | Workspace Name | Description |
|----------|----------------|-------------|
| **Pipeline** | `[dev] Danone Digital Twin ETL` | Lakeflow pipeline: bronze → silver → gold |
| **Job: Generator** | `[dev] Danone Twin - Event Generator` | Writes sensor JSON events every second to the UC Volume |
| **Job: Setup** | `[dev] Danone Twin - Setup (run once)` | Creates schema, volume, reference tables, seeds events |
| **App** | `danone-dairyflow` | DairyFlow FastAPI + React frontend (Databricks App) |

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

All tables land in `${var.catalog}.${var.schema}` (default: `danonedemo_catalog.digital_twin`).

---

## Variables

Override any variable at deploy time with `--var="key=value"`.

| Variable | Default (dev) | Default (prod) | Description |
|----------|--------------|----------------|-------------|
| `catalog` | `danonedemo_catalog` | `danonedemo_catalog` | Unity Catalog name |
| `schema` | `digital_twin` | `digital_twin_prod` | Schema for all tables |
| `volume_name` | `twin_landing` | `twin_landing_prod` | UC Volume for streaming events |
| `warehouse_id` | `50e0bc7f9918a201` | `50e0bc7f9918a201` | SQL warehouse for setup job + app queries |
| `run_duration_minutes` | `360` | `720` | Event generator run duration |
| `app_name` | `danone-dairyflow` | `danone-dairyflow-prod` | Databricks App name (unique per workspace) |
| `secret_scope` | `dairyflow-secrets` | `dairyflow-secrets-prod` | Databricks secret scope holding the PAT |
| `secret_key` | `databricks-pat` | `databricks-pat` | Key name inside the scope |

---

## Prerequisites

- Databricks CLI installed and authenticated:
  ```bash
  databricks configure --profile DEFAULT
  # Verify:
  databricks current-user me --profile DEFAULT
  ```
- Python 3.11+ with `databricks-sdk`: `pip install databricks-sdk`
- Node.js 18+ and npm (for building the DairyFlow frontend)
- Databricks secret scope with a PAT stored (see [App Authentication](#app-authentication) below)

---

## App Authentication (one-time per environment)

The DairyFlow app reads a Personal Access Token from Databricks Secrets to run SQL queries. Create the secret before the first deploy:

```bash
# Create the secret scope
databricks secrets create-scope dairyflow-secrets --profile DEFAULT

# Store your PAT
databricks secrets put-secret dairyflow-secrets databricks-pat \
  --string-value "dapi..." --profile DEFAULT
```

For a `prod` deployment, repeat with `dairyflow-secrets-prod` (or override `--var="secret_scope=..."` as needed).

---

## First-Time Setup (run once per environment)

### Step 1 — Build the frontend

```bash
./scripts/build_frontend.sh
```

This runs `npm ci && npm run build` in `apps/dairyflow/frontend/` and copies the production bundle into `apps/dairyflow/backend/static/` so it gets picked up by the bundle upload.

### Step 2 — Deploy the bundle

```bash
# Deploy to dev (default target)
databricks bundle deploy --profile DEFAULT

# Deploy to prod
databricks bundle deploy --target prod --profile DEFAULT
```

This creates or updates:
- The Lakeflow pipeline
- The event generator and setup jobs
- The DairyFlow Databricks App (uploads backend + static frontend)

### Step 3 — Run the setup job (once per environment)

```bash
# From the CLI:
databricks bundle run danone_twin_setup --profile DEFAULT

# Or run the local setup script instead (faster):
python scripts/setup_demo_local.py
```

This creates the schema and volume, uploads reference CSVs, and seeds 20 initial event files so the pipeline has data immediately.

---

## Demo Flow (on presentation day)

### Start the event generator

```bash
databricks bundle run danone_twin_event_generator --profile DEFAULT
```

This writes **3 sensor events per second** as JSON files to:
```
/Volumes/${var.catalog}/${var.schema}/${var.volume_name}/streaming_events/
```

### Start (or re-trigger) the Lakeflow pipeline

```bash
databricks bundle run danone_twin_etl --profile DEFAULT
```

Watch the pipeline DAG in the UI update live:
1. **Bronze** (`bronze_twin_events`): Auto Loader ingests new JSON files
2. **Silver** (`silver_twin_events`): Enriched stream with moisture quality flags
3. **Gold** (3 tables): Aggregated KPIs for equipment, batch yield, and sustainability

### Open the DairyFlow app

Find its URL:
```bash
databricks apps get danone-dairyflow --profile DEFAULT
```

Or in the Databricks UI: **Apps → danone-dairyflow → Open**.

### Query the gold tables directly

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

-- Raw event stream
SELECT event_ts, event_type, equipment_name, plant_id,
       temperature_c, moisture_pct, energy_kwh, alarm_code
FROM danonedemo_catalog.digital_twin.silver_twin_events
ORDER BY event_ts DESC LIMIT 50;
```

---

## Deploying to Multiple Environments

### Dev vs. Prod targets

```bash
# Dev (default)
databricks bundle deploy --profile DEFAULT

# Prod
databricks bundle deploy --target prod --profile DEFAULT
```

The `prod` target uses a separate schema (`digital_twin_prod`), a separate app name (`danone-dairyflow-prod`), and a separate secret scope (`dairyflow-secrets-prod`).

### Ad-hoc variable overrides

```bash
databricks bundle deploy --profile DEFAULT \
  --var="catalog=my_catalog" \
  --var="schema=my_schema" \
  --var="app_name=my-dairyflow" \
  --var="run_duration_minutes=20"
```

---

## Redeploying After Code Changes

### After any ETL SQL or generator change

```bash
databricks bundle deploy --profile DEFAULT
databricks bundle run danone_twin_etl --profile DEFAULT   # full refresh resets streaming state
```

### After a backend-only change (Python routers, etc.)

```bash
databricks bundle deploy --profile DEFAULT
# The app restarts automatically on the next request or you can trigger a redeploy:
databricks apps deploy danone-dairyflow \
  --source-code-path /Workspace/Users/christophe.anglade@databricks.com/.bundle/danone-digital-twin/dev/files/apps/dairyflow/backend \
  --profile DEFAULT
```

### After a frontend change

```bash
./scripts/build_frontend.sh          # rebuild React → static/
databricks bundle deploy --profile DEFAULT
```

---

## Project Structure

```
digital-twin/
├── databricks.yml                           # Bundle config: variables, targets, resource includes
├── README.md                                # Project overview and quick start
├── BUNDLE_DEPLOY.md                         # This file
│
├── resources/
│   ├── danone_twin_etl.pipeline.yml         # Lakeflow pipeline resource
│   ├── danone_twin_event_generator.job.yml  # Event generator job
│   ├── danone_twin_setup.job.yml            # One-time setup job
│   └── dairyflow.app.yml                    # DairyFlow Databricks App resource
│
├── src/
│   ├── danone_twin_etl/transformations/
│   │   ├── bronze_twin_events.sql           # STREAMING TABLE: Auto Loader from volume
│   │   ├── silver_twin_events.sql           # STREAMING TABLE: Enriched events
│   │   ├── gold_equipment_metrics.sql       # MATERIALIZED VIEW: 5-min equipment KPIs
│   │   ├── gold_batch_yield.sql             # MATERIALIZED VIEW: Per-batch quality
│   │   └── gold_sustainability_hourly.sql   # MATERIALIZED VIEW: Energy + water KPIs
│   └── generator/
│       ├── event_generator.py               # Core generator logic
│       └── run_generator.py                 # Databricks notebook wrapper
│
├── apps/
│   └── dairyflow/
│       ├── backend/                         # Deployed to Databricks Apps
│       │   ├── app.yaml                     # App entrypoint + env var defaults
│       │   ├── start.py                     # Uvicorn launcher
│       │   ├── main.py                      # FastAPI app
│       │   ├── databricks_client.py         # M2M → PAT auth + SQL client
│       │   ├── requirements.txt
│       │   ├── routers/                     # stream, equipment, batches, sustainability, graph, simulate
│       │   └── static/                      # Pre-built React SPA (generated by build_frontend.sh)
│       └── frontend/                        # React + TypeScript source
│           ├── src/
│           ├── package.json
│           └── vite.config.ts
│
├── scripts/
│   ├── build_frontend.sh                    # Build React → apps/dairyflow/backend/static/
│   ├── setup_demo_local.py                  # Local setup script
│   └── setup_demo.py                        # Databricks notebook setup
│
└── data/
    ├── equipment.csv
    └── raw_material_batches.csv
```

---

## Demo Reset

To reset streaming data and run the demo fresh:

```bash
# Clear seeded files and streaming state
python3.11 -c "
from databricks.sdk import WorkspaceClient
w = WorkspaceClient(profile='DEFAULT')
files = list(w.files.list_directory_contents('/Volumes/danonedemo_catalog/digital_twin/twin_landing/streaming_events'))
for f in files:
    w.files.delete(f.path)
    print(f'Deleted: {f.path}')
print(f'Cleared {len(files)} files.')
"

# Drop pipeline tables
python3.11 -c "
from databricks.sdk import WorkspaceClient
w = WorkspaceClient(profile='DEFAULT')
wh = '50e0bc7f9918a201'
for t in ['bronze_twin_events','silver_twin_events','gold_equipment_metrics','gold_batch_yield','gold_sustainability_hourly']:
    w.statement_execution.execute_statement(warehouse_id=wh, statement=f'DROP TABLE IF EXISTS danonedemo_catalog.digital_twin.{t}', wait_timeout='30s')
    print(f'Dropped: {t}')
"

# Re-seed events and restart
python scripts/setup_demo_local.py
databricks bundle run danone_twin_etl --profile DEFAULT
```

---

## Workspace Links (dev environment)

| Resource | Link |
|----------|------|
| DairyFlow App (live) | https://danone-dairyflow-7474655187458913.aws.databricksapps.com |
| Pipeline | https://fevm-danonedemo.cloud.databricks.com/pipelines/67ab1515-48ef-448d-b7f8-0fa128776947 |
| Generator job | https://fevm-danonedemo.cloud.databricks.com/jobs/765791638727704 |
| Setup job | https://fevm-danonedemo.cloud.databricks.com/jobs/250008881976566 |
