# Databricks notebook source
# MAGIC %md
# MAGIC # Danone Digital Twin — Streaming Event Generator
# MAGIC
# MAGIC Runs the synthetic sensor event generator that writes JSON files to a Unity Catalog volume
# MAGIC every second. Start this notebook (via job or manually) before or alongside the Lakeflow
# MAGIC pipeline to showcase real-time streaming ingestion capabilities.
# MAGIC
# MAGIC **Parameters (set as job parameters or widget defaults):**
# MAGIC - `STREAMING_EVENTS_VOLUME_PATH` – where JSON files are written (Auto Loader source)
# MAGIC - `RUN_DURATION_MINUTES` – how long to run (default: 10 min)
# MAGIC - `EVENTS_PER_TICK` – events per second (default: 3)

# COMMAND ----------

import os

# Widget parameters – override via job parameters or Databricks widget UI
dbutils.widgets.text(
    "STREAMING_EVENTS_VOLUME_PATH",
    "/Volumes/danonedemo_catalog/digital_twin/twin_landing/streaming_events",
    "Volume path for streaming events"
)
dbutils.widgets.text("RUN_DURATION_MINUTES", "360", "Run duration (minutes)")
dbutils.widgets.text("EVENTS_PER_TICK", "10", "Events per tick (per second)")

# COMMAND ----------

# Set env vars so event_generator.py picks them up
os.environ["STREAMING_EVENTS_VOLUME_PATH"] = dbutils.widgets.get("STREAMING_EVENTS_VOLUME_PATH")
os.environ["RUN_DURATION_MINUTES"]          = dbutils.widgets.get("RUN_DURATION_MINUTES")
os.environ["EVENTS_PER_TICK"]               = dbutils.widgets.get("EVENTS_PER_TICK")

volume_path = os.environ["STREAMING_EVENTS_VOLUME_PATH"]
duration    = int(os.environ["RUN_DURATION_MINUTES"])
events_tick = int(os.environ["EVENTS_PER_TICK"])

print(f"Volume path     : {volume_path}")
print(f"Run duration    : {duration} minutes")
print(f"Events per tick : {events_tick}")

# COMMAND ----------

# Ensure the target directory exists inside the volume
import pathlib
target_dir = pathlib.Path(volume_path)
target_dir.mkdir(parents=True, exist_ok=True)
print(f"Target directory ensured: {target_dir}")

# COMMAND ----------

# Run the event generator
import sys
import importlib

# Add generator module directory to path
notebook_dir = os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else "/Workspace/files/src/generator"
if notebook_dir not in sys.path:
    sys.path.insert(0, notebook_dir)

# Import and run
import event_generator
importlib.reload(event_generator)  # Reload in case of reruns
event_generator.run()

# COMMAND ----------

print("Event generator completed successfully.")
print(f"Files written to: {volume_path}")
print("The Lakeflow pipeline Auto Loader will have ingested the events into bronze_twin_events.")
