# Databricks notebook source
# MAGIC %md
# MAGIC # Danone Digital Twin — One-Time Demo Setup
# MAGIC
# MAGIC This notebook:
# MAGIC 1. Creates the catalog schema and Unity Catalog volume
# MAGIC 2. Loads reference data (equipment, raw material batches) into Delta tables
# MAGIC 3. Seeds a few initial streaming event files in the volume so the pipeline starts immediately
# MAGIC
# MAGIC **Run once** per environment before starting the demo.

# COMMAND ----------

import os

dbutils.widgets.text("CATALOG",      "danonedemo_catalog",  "Unity Catalog")
dbutils.widgets.text("SCHEMA",       "digital_twin",         "Schema")
dbutils.widgets.text("VOLUME_NAME",  "twin_landing",         "Volume name")
dbutils.widgets.text("WAREHOUSE_ID", "",                     "SQL Warehouse ID (optional)")

CATALOG      = dbutils.widgets.get("CATALOG")
SCHEMA       = dbutils.widgets.get("SCHEMA")
VOLUME_NAME  = dbutils.widgets.get("VOLUME_NAME")
VOLUME_PATH  = f"/Volumes/{CATALOG}/{SCHEMA}/{VOLUME_NAME}"
EVENTS_PATH  = f"{VOLUME_PATH}/streaming_events"

print(f"Catalog      : {CATALOG}")
print(f"Schema       : {SCHEMA}")
print(f"Volume       : {VOLUME_NAME}")
print(f"Volume path  : {VOLUME_PATH}")
print(f"Events path  : {EVENTS_PATH}")

# COMMAND ----------
# MAGIC %md ## Step 1 – Create schema and volume

# COMMAND ----------

spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.{SCHEMA}")
print(f"Schema ready: {CATALOG}.{SCHEMA}")

spark.sql(f"CREATE VOLUME IF NOT EXISTS {CATALOG}.{SCHEMA}.{VOLUME_NAME}")
print(f"Volume ready: {CATALOG}.{SCHEMA}.{VOLUME_NAME}")

# Create the streaming events sub-directory
import pathlib
pathlib.Path(EVENTS_PATH).mkdir(parents=True, exist_ok=True)
print(f"Events directory ready: {EVENTS_PATH}")

# COMMAND ----------
# MAGIC %md ## Step 2 – Load reference tables from bundle files

# COMMAND ----------

import os, sys

# Locate the bundle files directory (uploaded by the bundle to workspace).
# The bundle deploys to /Workspace/Users/<user>/.bundle/<name>/<target>/files/
# The notebook itself lives at .../files/scripts/setup_demo, so we go up two
# levels from the notebook path to reach the files root.
_notebook_path = dbutils.notebook.entry_point.getDbutils().notebook().getContext().notebookPath().get()
# _notebook_path is a workspace path like /Workspace/Users/.../files/scripts/setup_demo
# Convert to a filesystem path (prefix with /Workspace if not already absolute)
_notebook_fs = _notebook_path if _notebook_path.startswith("/Workspace") else f"/Workspace{_notebook_path}"
bundle_files_base = os.path.dirname(os.path.dirname(_notebook_fs))  # up from scripts/ → files root

data_dir = os.path.join(bundle_files_base, "data")
print(f"Notebook path   : {_notebook_path}")
print(f"Bundle files    : {bundle_files_base}")
print(f"Data directory  : {data_dir}")

def load_reference_csv(filename: str, table_name: str) -> None:
    """Load a CSV from the data/ directory into a Delta table."""
    local_path = os.path.join(data_dir, filename)
    volume_dest = f"{VOLUME_PATH}/reference/{filename}"

    # Copy CSV from workspace files → UC Volume (both paths are filesystem-accessible)
    pathlib.Path(os.path.dirname(volume_dest)).mkdir(parents=True, exist_ok=True)
    import shutil
    shutil.copy2(local_path, volume_dest)
    print(f"  Copied {filename} → {volume_dest}")

    # Read from the volume path (accessible to Spark on serverless) and save as Delta
    full_table = f"{CATALOG}.{SCHEMA}.{table_name}"
    df = spark.read.csv(volume_dest, header=True, inferSchema=True)
    df.write.format("delta").mode("overwrite").saveAsTable(full_table)
    print(f"  Loaded {df.count()} rows into {full_table}")

print("Loading equipment reference data...")
load_reference_csv("equipment.csv", "equipment")

print("\nLoading raw material batches reference data...")
load_reference_csv("raw_material_batches.csv", "raw_material_batches")

print("\nReference tables ready.")

# COMMAND ----------
# MAGIC %md ## Step 3 – Seed initial streaming events

# COMMAND ----------

# Seed 30 seconds of events so the pipeline has data to ingest immediately

sys.path.insert(0, os.path.join(bundle_files_base, "src", "generator"))
import event_generator
import importlib
importlib.reload(event_generator)

import os
os.environ["STREAMING_EVENTS_VOLUME_PATH"] = EVENTS_PATH
os.environ["RUN_DURATION_MINUTES"] = "0"  # we will run manually below
os.environ["EVENTS_PER_TICK"] = "5"

import json, uuid
from datetime import datetime, timezone

print("Seeding 30 initial event files (1 file per simulated second)...")
for i in range(30):
    events = event_generator.generate_tick_events(5)
    ts_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"events_{ts_str}_seed_{i:04d}_{str(uuid.uuid4())[:8]}.json"
    file_path = os.path.join(EVENTS_PATH, filename)
    with open(file_path, "w") as f:
        f.write("\n".join(json.dumps(e) for e in events))

print(f"Seeded 30 files in {EVENTS_PATH}")
print("Setup complete! You can now:")
print("  1. Start the Lakeflow pipeline 'Danone Digital Twin ETL'")
print("  2. Start the event generator job to produce live streaming events")

# COMMAND ----------
# MAGIC %md ## Step 4 – Verify tables

# COMMAND ----------

display(spark.sql(f"SELECT * FROM {CATALOG}.{SCHEMA}.equipment LIMIT 10"))

# COMMAND ----------

display(spark.sql(f"SELECT * FROM {CATALOG}.{SCHEMA}.raw_material_batches LIMIT 10"))

# COMMAND ----------

# Count seeded files
import glob
seeded = glob.glob(f"{EVENTS_PATH}/*.json")
print(f"Seeded event files in volume: {len(seeded)}")
print(f"Example: {seeded[0] if seeded else 'none'}")
