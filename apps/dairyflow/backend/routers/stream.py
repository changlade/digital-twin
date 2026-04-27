"""Polling endpoint — returns latest silver_twin_events (last 5 seconds).

Replaces SSE: Databricks Apps' HTTP/2 reverse proxy kills persistent streams.
The frontend polls this endpoint every 2 seconds instead.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter

from databricks_client import execute_sql

router = APIRouter(tags=["stream"])
log = logging.getLogger(__name__)


_EVENT_COLS = """
        CAST(event_ts AS STRING)          AS event_ts,
        event_type,
        equipment_id,
        equipment_name,
        equipment_type,
        plant_id,
        line_id,
        batch_id,
        CAST(temperature_c AS DOUBLE)     AS temperature_c,
        CAST(moisture_pct AS DOUBLE)      AS moisture_pct,
        CAST(energy_kwh AS DOUBLE)        AS energy_kwh,
        CAST(flow_rate_l_min AS DOUBLE)   AS flow_rate_lph,
        CAST(viscosity_cp AS DOUBLE)      AS viscosity_cp,
        CAST(pressure_kpa AS DOUBLE)      AS pressure_kpa,
        alarm_code,
        moisture_quality"""


def _fetch_events(seconds: int, limit: int) -> list[dict]:
    sql = f"""
    SELECT {_EVENT_COLS}
    FROM silver_twin_events
    WHERE event_ts >= current_timestamp() - INTERVAL {seconds} SECONDS
    ORDER BY event_ts DESC
    LIMIT {limit}
    """
    try:
        return execute_sql(sql, timeout=10)
    except Exception as exc:
        log.warning("Poll error: %s", exc)
        return []


@router.get("/stream-poll")
def poll_events():
    """Return sensor events from the last 30 s. Frontend polls every 2 s."""
    events = _fetch_events(seconds=30, limit=60)
    return {
        "events": events,
        "ts": datetime.now(timezone.utc).isoformat(),
        "count": len(events),
    }


@router.get("/stream-history")
def stream_history():
    """Return the last 5 minutes of events for initial chart pre-population."""
    events = _fetch_events(seconds=300, limit=500)
    # Return oldest-first so the chart renders left-to-right chronologically
    events.reverse()
    return {
        "events": events,
        "ts": datetime.now(timezone.utc).isoformat(),
        "count": len(events),
    }
