"""
Danone Digital Twin - Streaming Event Generator

Generates synthetic Bio-Mechanical-Sustainability sensor events every second
and writes them as individual JSON files to a Unity Catalog volume path.
Auto Loader in the Lakeflow pipeline picks up these files continuously.

Run modes:
  - On Databricks (job task): configures via env vars / task params
  - Locally (dev): pass STREAMING_EVENTS_VOLUME_PATH and optionally RUN_DURATION_MINUTES

Usage on Databricks:
  Env vars (set in job):
    STREAMING_EVENTS_VOLUME_PATH  - e.g. /Volumes/danonedemo_catalog/digital_twin/twin_landing/streaming_events
    RUN_DURATION_MINUTES          - default 10
    EVENTS_PER_TICK               - default 3
"""

import json
import os
import random
import time
import uuid
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

VOLUME_PATH = os.environ.get(
    "STREAMING_EVENTS_VOLUME_PATH",
    "/Volumes/danonedemo_catalog/digital_twin/twin_landing/streaming_events",
)
RUN_DURATION_MINUTES = int(os.environ.get("RUN_DURATION_MINUTES", "360"))
EVENTS_PER_TICK = int(os.environ.get("EVENTS_PER_TICK", "10"))
SLEEP_SECONDS = float(os.environ.get("SLEEP_SECONDS", "1.0"))


# ---------------------------------------------------------------------------
# Reference data (mirrors data/equipment.csv & raw_material_batches.csv)
# ---------------------------------------------------------------------------

PLANTS = ["PLANT-OPGLIÈRES", "PLANT-ALMERÍA"]

EQUIPMENT = [
    {"equipment_id": "EQ-SD-001", "name": "Spray Dryer Alpha",    "type": "spray_dryer",    "line_id": "LINE-A", "plant_id": "PLANT-OPGLIÈRES"},
    {"equipment_id": "EQ-SD-002", "name": "Spray Dryer Beta",     "type": "spray_dryer",    "line_id": "LINE-A", "plant_id": "PLANT-OPGLIÈRES"},
    {"equipment_id": "EQ-SD-003", "name": "Spray Dryer Gamma",    "type": "spray_dryer",    "line_id": "LINE-B", "plant_id": "PLANT-OPGLIÈRES"},
    {"equipment_id": "EQ-SD-004", "name": "Spray Dryer Nutricia-1","type": "spray_dryer",   "line_id": "LINE-C", "plant_id": "PLANT-ALMERÍA"},
    {"equipment_id": "EQ-SD-005", "name": "Spray Dryer Nutricia-2","type": "spray_dryer",   "line_id": "LINE-C", "plant_id": "PLANT-ALMERÍA"},
    {"equipment_id": "EQ-MX-001", "name": "Continuous Mixer Alpha","type": "mixer",         "line_id": "LINE-A", "plant_id": "PLANT-OPGLIÈRES"},
    {"equipment_id": "EQ-MX-002", "name": "Continuous Mixer Beta", "type": "mixer",         "line_id": "LINE-B", "plant_id": "PLANT-OPGLIÈRES"},
    {"equipment_id": "EQ-MX-003", "name": "High-Shear Mixer Nutricia","type": "mixer",      "line_id": "LINE-C", "plant_id": "PLANT-ALMERÍA"},
    {"equipment_id": "EQ-HE-001", "name": "Heat Exchanger A1",    "type": "heat_exchanger", "line_id": "LINE-A", "plant_id": "PLANT-OPGLIÈRES"},
    {"equipment_id": "EQ-HE-002", "name": "Heat Exchanger A2",    "type": "heat_exchanger", "line_id": "LINE-B", "plant_id": "PLANT-OPGLIÈRES"},
    {"equipment_id": "EQ-HE-003", "name": "Pasteurizer Nutricia", "type": "heat_exchanger", "line_id": "LINE-C", "plant_id": "PLANT-ALMERÍA"},
    {"equipment_id": "EQ-CIP-001","name": "CIP Unit Alpha",       "type": "cip_unit",       "line_id": "LINE-A", "plant_id": "PLANT-OPGLIÈRES"},
    {"equipment_id": "EQ-CIP-002","name": "CIP Unit Beta",        "type": "cip_unit",       "line_id": "LINE-B", "plant_id": "PLANT-OPGLIÈRES"},
    {"equipment_id": "EQ-CIP-003","name": "CIP Unit Nutricia",    "type": "cip_unit",       "line_id": "LINE-C", "plant_id": "PLANT-ALMERÍA"},
    {"equipment_id": "EQ-PKG-001","name": "Packing Line Alpha",   "type": "packing",        "line_id": "LINE-A", "plant_id": "PLANT-OPGLIÈRES"},
    {"equipment_id": "EQ-PKG-002","name": "Packing Line Beta",    "type": "packing",        "line_id": "LINE-B", "plant_id": "PLANT-OPGLIÈRES"},
    {"equipment_id": "EQ-PKG-003","name": "Packing Line Nutricia","type": "packing",        "line_id": "LINE-C", "plant_id": "PLANT-ALMERÍA"},
]

BATCH_IDS = [f"BATCH-2026-{str(i).zfill(3)}" for i in range(1, 16)]

# Active batches per line (simulates ongoing production)
_active_batches: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Event generators by equipment type
# ---------------------------------------------------------------------------

def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _base_event(eq: dict, event_type: str, batch_id: str | None) -> dict:
    return {
        "event_id": str(uuid.uuid4()),
        "event_ts": _ts(),
        "event_type": event_type,
        "equipment_id": eq["equipment_id"],
        "equipment_name": eq["name"],
        "equipment_type": eq["type"],
        "line_id": eq["line_id"],
        "plant_id": eq["plant_id"],
        "batch_id": batch_id,
    }


def gen_spray_dryer_event(eq: dict, batch_id: str | None) -> dict:
    """Spray dryer: temperature 160–220°C inlet, 60–90°C outlet; moisture 3–5%."""
    event = _base_event(eq, "sensor_reading", batch_id)
    # Higher temperature = lower moisture (inverse relationship for realism)
    inlet_temp = round(random.gauss(195, 8), 2)
    outlet_temp = round(random.gauss(75, 5), 2)
    moisture = round(max(2.5, min(6.0, 4.5 - (inlet_temp - 195) * 0.02 + random.gauss(0, 0.3))), 2)
    energy_kwh = round(random.gauss(450, 30), 2)
    water_steam_liters = round(random.gauss(1200, 80), 2)
    event.update({
        "inlet_temperature_c": inlet_temp,
        "outlet_temperature_c": outlet_temp,
        "temperature_c": outlet_temp,
        "pressure_kpa": round(random.gauss(101.3, 2), 2),
        "flow_rate_l_min": round(random.gauss(85, 5), 2),
        "moisture_pct": moisture,
        "energy_kwh": energy_kwh,
        "water_steam_liters": water_steam_liters,
        "water_liters": water_steam_liters,
        "powder_output_kg_h": round(random.gauss(1800, 100), 2),
        "air_flow_m3_h": round(random.gauss(18000, 500), 2),
    })
    # Occasional alarm: moisture out of spec (Gold Standard for Nutricia)
    if moisture > 5.0 or moisture < 3.0:
        event["event_type"] = "alarm"
        event["alarm_code"] = "MOISTURE_OUT_OF_SPEC"
        event["alarm_severity"] = "HIGH" if abs(moisture - 4.0) > 1.5 else "MEDIUM"
    return event


def gen_mixer_event(eq: dict, batch_id: str | None) -> dict:
    """Mixer: viscosity (biological variable), temperature, flow."""
    event = _base_event(eq, "sensor_reading", batch_id)
    viscosity = round(random.gauss(850, 60), 2)
    event.update({
        "temperature_c": round(random.gauss(72, 3), 2),
        "pressure_kpa": round(random.gauss(205, 5), 2),
        "flow_rate_l_min": round(random.gauss(120, 8), 2),
        "viscosity_cp": viscosity,
        "mixing_speed_rpm": round(random.gauss(3200, 150), 2),
        "protein_pct": round(random.gauss(32, 0.5), 2),
        "fat_pct": round(random.gauss(26.5, 0.4), 2),
        "energy_kwh": round(random.gauss(85, 8), 2),
        "water_liters": round(random.gauss(200, 15), 2),
    })
    # High viscosity → alarm
    if viscosity > 1050 or viscosity < 650:
        event["event_type"] = "alarm"
        event["alarm_code"] = "VISCOSITY_OUT_OF_RANGE"
        event["alarm_severity"] = "MEDIUM"
    return event


def gen_heat_exchanger_event(eq: dict, batch_id: str | None) -> dict:
    """Heat exchanger / pasteurizer: temperature, pressure."""
    event = _base_event(eq, "sensor_reading", batch_id)
    temp = round(random.gauss(78, 2), 2)
    event.update({
        "temperature_c": temp,
        "inlet_temperature_c": round(random.gauss(5, 1), 2),
        "outlet_temperature_c": temp,
        "pressure_kpa": round(random.gauss(310, 8), 2),
        "flow_rate_l_min": round(random.gauss(200, 12), 2),
        "energy_kwh": round(random.gauss(120, 10), 2),
        "water_liters": round(random.gauss(50, 5), 2),
    })
    return event


def gen_cip_event(eq: dict, batch_id: str | None) -> dict:
    """CIP (Cleaning-In-Place): water usage – key sustainability metric."""
    event = _base_event(eq, "sensor_reading", batch_id)
    # CIP is the big water user – demo: can show 'Circular Water Twin'
    water = round(random.gauss(3500, 300), 2)
    event.update({
        "temperature_c": round(random.gauss(85, 3), 2),
        "pressure_kpa": round(random.gauss(380, 15), 2),
        "flow_rate_l_min": round(random.gauss(380, 25), 2),
        "water_liters": water,
        "chemical_consumption_l": round(random.gauss(12, 1.5), 2),
        "energy_kwh": round(random.gauss(95, 10), 2),
        "cip_phase": random.choice(["pre_rinse", "caustic_wash", "intermediate_rinse", "acid_wash", "final_rinse"]),
    })
    # Water leak alarm
    if water > 4500:
        event["event_type"] = "alarm"
        event["alarm_code"] = "WATER_OVERCONSUMPTION"
        event["alarm_severity"] = "MEDIUM"
    return event


def gen_packing_event(eq: dict, batch_id: str | None) -> dict:
    """Packing line: output rate, energy."""
    event = _base_event(eq, "sensor_reading", batch_id)
    event.update({
        "temperature_c": round(random.gauss(22, 2), 2),
        "pressure_kpa": round(random.gauss(6, 0.5), 2),
        "packing_speed_cans_min": round(random.gauss(320, 15), 2),
        "energy_kwh": round(random.gauss(45, 5), 2),
        "water_liters": round(random.gauss(8, 1), 2),
        "reject_rate_pct": round(max(0, random.gauss(0.8, 0.3)), 2),
    })
    return event


# Dispatch by equipment type
_GEN_MAP = {
    "spray_dryer": gen_spray_dryer_event,
    "mixer": gen_mixer_event,
    "heat_exchanger": gen_heat_exchanger_event,
    "cip_unit": gen_cip_event,
    "packing": gen_packing_event,
}


def gen_batch_lifecycle_event(eq: dict, batch_id: str, event_type: str) -> dict:
    """Batch start / end / quality check events."""
    event = _base_event(eq, event_type, batch_id)
    if event_type == "quality_check":
        event.update({
            "moisture_pct": round(random.gauss(4.1, 0.2), 2),
            "protein_pct": round(random.gauss(32.0, 0.4), 2),
            "fat_pct": round(random.gauss(26.5, 0.3), 2),
            "viscosity_cp": round(random.gauss(850, 50), 2),
            "first_time_right": random.random() > 0.05,
        })
    return event


def generate_tick_events(n: int) -> list[dict]:
    """Generate n events for this tick, mixing equipment types."""
    events = []
    selected_eqs = random.choices(EQUIPMENT, k=n)
    for eq in selected_eqs:
        eq_type = eq["type"]

        # Manage active batch for this equipment
        eq_id = eq["equipment_id"]
        if eq_id not in _active_batches:
            _active_batches[eq_id] = random.choice(BATCH_IDS)
            events.append(gen_batch_lifecycle_event(eq, _active_batches[eq_id], "batch_start"))

        batch_id = _active_batches[eq_id]

        # Occasionally rotate batch (simulate new batch starting)
        if random.random() < 0.002:
            events.append(gen_batch_lifecycle_event(eq, batch_id, "batch_end"))
            events.append(gen_batch_lifecycle_event(eq, batch_id, "quality_check"))
            _active_batches[eq_id] = random.choice(BATCH_IDS)
            batch_id = _active_batches[eq_id]
            events.append(gen_batch_lifecycle_event(eq, batch_id, "batch_start"))

        gen_fn = _GEN_MAP.get(eq_type)
        if gen_fn:
            events.append(gen_fn(eq, batch_id))

    return events


# ---------------------------------------------------------------------------
# Writer: Databricks Files API (on cluster) or local (dev)
# ---------------------------------------------------------------------------

def write_events_to_volume(events: list[dict], volume_path: str, tick: int) -> None:
    """Write events as a single JSON-lines file to the volume."""
    ts_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    short_id = str(uuid.uuid4())[:8]
    filename = f"events_{ts_str}_{tick:06d}_{short_id}.json"
    content = "\n".join(json.dumps(e) for e in events)
    file_path = f"{volume_path.rstrip('/')}/{filename}"

    try:
        # On Databricks cluster: use dbutils or direct file write to /Volumes/
        with open(file_path, "w") as f:
            f.write(content)
        print(f"[tick {tick:06d}] wrote {len(events)} events → {filename}")
    except Exception as e:
        # Fallback: try Databricks SDK Files API
        try:
            from databricks.sdk import WorkspaceClient
            w = WorkspaceClient()
            w.files.upload(file_path=file_path, contents=content.encode())
            print(f"[tick {tick:06d}] (SDK) wrote {len(events)} events → {filename}")
        except Exception as sdk_err:
            print(f"[tick {tick:06d}] ERROR writing events: {e} | SDK: {sdk_err}")
            raise


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def run() -> None:
    total_seconds = RUN_DURATION_MINUTES * 60
    print("=" * 60)
    print("Danone Digital Twin – Event Generator")
    print(f"  Volume path     : {VOLUME_PATH}")
    print(f"  Run duration    : {RUN_DURATION_MINUTES} min ({total_seconds} ticks)")
    print(f"  Events per tick : {EVENTS_PER_TICK}")
    print(f"  Tick interval   : {SLEEP_SECONDS}s")
    print("=" * 60)

    tick = 0
    total_events = 0
    start_time = time.time()

    while (time.time() - start_time) < total_seconds:
        tick_start = time.time()
        events = generate_tick_events(EVENTS_PER_TICK)
        write_events_to_volume(events, VOLUME_PATH, tick)
        total_events += len(events)
        tick += 1

        # Sleep for remainder of the tick interval
        elapsed = time.time() - tick_start
        sleep_time = max(0.0, SLEEP_SECONDS - elapsed)
        if sleep_time > 0:
            time.sleep(sleep_time)

    elapsed_total = time.time() - start_time
    print("=" * 60)
    print(f"Generator finished: {tick} ticks, {total_events} events in {elapsed_total:.1f}s")
    print("=" * 60)


if __name__ == "__main__":
    run()
