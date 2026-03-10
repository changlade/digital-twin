#!/usr/bin/env python3
"""
Danone Digital Twin – One-Time Local Setup Script

Runs locally using your DEFAULT Databricks CLI profile to:
  1. Create the catalog schema and Unity Catalog volume
  2. Upload reference CSVs (equipment, raw_material_batches) to the volume
  3. Create Delta reference tables via SQL
  4. Seed 30 initial streaming event files so the pipeline has data immediately

Usage:
  cd danone-digital-twin/
  python scripts/setup_demo_local.py

Optional overrides (env vars):
  DATABRICKS_CONFIG_PROFILE=DEFAULT   (default)
  CATALOG=danonedemo_catalog
  SCHEMA=digital_twin
  VOLUME_NAME=twin_landing
  WAREHOUSE_ID=50e0bc7f9918a201
"""

import json
import os
import sys
import time
import uuid
from pathlib import Path
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PROFILE      = os.environ.get("DATABRICKS_CONFIG_PROFILE", "DEFAULT")
CATALOG      = os.environ.get("CATALOG",      "danonedemo_catalog")
SCHEMA       = os.environ.get("SCHEMA",       "digital_twin")
VOLUME_NAME  = os.environ.get("VOLUME_NAME",  "twin_landing")
WAREHOUSE_ID = os.environ.get("WAREHOUSE_ID", "50e0bc7f9918a201")

SCRIPT_DIR   = Path(__file__).resolve().parent
BUNDLE_ROOT  = SCRIPT_DIR.parent
DATA_DIR     = BUNDLE_ROOT / "data"
GENERATOR_DIR = BUNDLE_ROOT / "src" / "generator"

VOLUME_PATH  = f"/Volumes/{CATALOG}/{SCHEMA}/{VOLUME_NAME}"
EVENTS_PATH  = f"{VOLUME_PATH}/streaming_events"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def print_step(n: int, title: str) -> None:
    print(f"\n{'='*60}")
    print(f"  Step {n}: {title}")
    print(f"{'='*60}")


def run_sql(w, statement: str, wait: bool = True) -> None:
    """Execute a SQL statement on the configured warehouse."""
    from databricks.sdk.service.sql import StatementState
    resp = w.statement_execution.execute_statement(
        warehouse_id=WAREHOUSE_ID,
        statement=statement,
        wait_timeout="30s",
    )
    state = resp.status.state if resp.status else None
    if state == StatementState.FAILED:
        raise RuntimeError(f"SQL failed: {resp.status.error.message if resp.status.error else 'unknown'}\nSQL: {statement[:200]}")
    if state == StatementState.SUCCEEDED or state == StatementState.CLOSED:
        print(f"  OK: {statement[:80].strip()}...")
        return
    # Wait for completion
    stmt_id = resp.statement_id
    for _ in range(60):
        time.sleep(2)
        resp = w.statement_execution.get_statement(stmt_id)
        state = resp.status.state if resp.status else None
        if state in (StatementState.SUCCEEDED, StatementState.CLOSED):
            print(f"  OK: {statement[:80].strip()}...")
            return
        if state == StatementState.FAILED:
            raise RuntimeError(f"SQL failed: {resp.status.error.message if resp.status.error else 'unknown'}")
    raise TimeoutError(f"SQL timed out: {statement[:80]}")


def upload_to_volume(w, local_path: Path, volume_file_path: str) -> None:
    """Upload a local file to the Unity Catalog volume via Files API."""
    import io
    with open(local_path, "rb") as f:
        data = f.read()
    w.files.upload(file_path=volume_file_path, contents=io.BytesIO(data), overwrite=True)
    print(f"  Uploaded: {local_path.name} → {volume_file_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("Danone Digital Twin – Demo Setup")
    print(f"  Profile    : {PROFILE}")
    print(f"  Catalog    : {CATALOG}")
    print(f"  Schema     : {SCHEMA}")
    print(f"  Volume     : {VOLUME_NAME}")
    print(f"  Warehouse  : {WAREHOUSE_ID}")
    print("=" * 60)

    from databricks.sdk import WorkspaceClient
    w = WorkspaceClient(profile=PROFILE)
    print(f"\nConnected to: {w.config.host}")
    me = w.current_user.me()
    print(f"As user     : {me.user_name}")

    # ------------------------------------------------------------------
    print_step(1, "Create schema and volume")
    # ------------------------------------------------------------------
    run_sql(w, f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.{SCHEMA}")
    run_sql(w, f"CREATE VOLUME IF NOT EXISTS {CATALOG}.{SCHEMA}.{VOLUME_NAME}")
    print(f"  Schema and volume ready: {CATALOG}.{SCHEMA}.{VOLUME_NAME}")

    # ------------------------------------------------------------------
    print_step(2, "Upload reference CSVs to volume")
    # ------------------------------------------------------------------
    ref_dir = f"{VOLUME_PATH}/reference"
    for csv_name in ["equipment.csv", "raw_material_batches.csv"]:
        local = DATA_DIR / csv_name
        if not local.exists():
            print(f"  WARN: {csv_name} not found in {DATA_DIR} – skip")
            continue
        upload_to_volume(w, local, f"{ref_dir}/{csv_name}")

    # ------------------------------------------------------------------
    print_step(3, "Create Delta reference tables from volume CSVs")
    # ------------------------------------------------------------------
    run_sql(w, f"""
        CREATE OR REPLACE TABLE {CATALOG}.{SCHEMA}.equipment
        USING DELTA AS
        SELECT * FROM read_files(
          '{ref_dir}/equipment.csv',
          format => 'csv',
          header => true,
          inferSchema => true
        )
    """)

    run_sql(w, f"""
        CREATE OR REPLACE TABLE {CATALOG}.{SCHEMA}.raw_material_batches
        USING DELTA AS
        SELECT * FROM read_files(
          '{ref_dir}/raw_material_batches.csv',
          format => 'csv',
          header => true,
          inferSchema => true
        )
    """)
    print("  Reference tables ready in Unity Catalog.")

    # ------------------------------------------------------------------
    print_step(4, "Seed initial streaming event files")
    # ------------------------------------------------------------------
    sys.path.insert(0, str(GENERATOR_DIR))
    import event_generator
    import importlib
    importlib.reload(event_generator)

    # Set env so generator writes to our path
    os.environ["STREAMING_EVENTS_VOLUME_PATH"] = EVENTS_PATH
    os.environ["EVENTS_PER_TICK"] = "5"

    n_seed = 20
    print(f"  Seeding {n_seed} event files into {EVENTS_PATH} via Files API ...")
    for i in range(n_seed):
        events = event_generator.generate_tick_events(5)
        ts_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        short_id = str(uuid.uuid4())[:8]
        filename = f"events_{ts_str}_seed_{i:04d}_{short_id}.json"
        import io
        content = "\n".join(json.dumps(e) for e in events).encode()
        file_path = f"{EVENTS_PATH}/{filename}"
        w.files.upload(file_path=file_path, contents=io.BytesIO(content), overwrite=True)
        if i % 5 == 0:
            print(f"    ... {i+1}/{n_seed} files seeded")
        time.sleep(0.1)  # slight delay to get different timestamps

    print(f"  Seeded {n_seed} event files.")

    # ------------------------------------------------------------------
    print()
    print("=" * 60)
    print("Setup complete!")
    print()
    print("Next steps for the demo:")
    print(f"  1. Start the Lakeflow pipeline:")
    print(f"       databricks bundle run danone_twin_etl --profile DEFAULT")
    print(f"     Or open: https://fevm-danonedemo.cloud.databricks.com/pipelines/")
    print()
    print(f"  2. Start the event generator (generates events every 1 second):")
    print(f"       databricks bundle run danone_twin_event_generator --profile DEFAULT")
    print()
    print(f"  3. Watch bronze/silver/gold tables populate in real time in the UI!")
    print("=" * 60)


if __name__ == "__main__":
    main()
