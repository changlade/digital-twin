"""Knowledge graph endpoint — nodes and edges for the Bio-Mechanical twin."""
import traceback
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from databricks_client import execute_sql

router = APIRouter(tags=["graph"])


def _error(exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "traceback": traceback.format_exc()},
    )


@router.get("/graph")
def get_graph():
    try:
        equipment_sql = """
        SELECT
            e.equipment_id,
            e.equipment_name,
            e.equipment_type,
            e.plant_id,
            e.line_id,
            COALESCE(CAST(m.avg_temperature_c AS DOUBLE), 0.0)  AS avg_temperature_c,
            COALESCE(CAST(m.total_energy_kwh AS DOUBLE), 0.0)   AS total_energy_kwh,
            COALESCE(CAST(m.alarm_count AS INT), 0)             AS alarm_count
        FROM danonedemo_catalog.digital_twin.equipment e
        LEFT JOIN (
            SELECT equipment_id,
                   avg_temperature_c,
                   total_energy_kwh,
                   alarm_count
            FROM danonedemo_catalog.digital_twin.gold_equipment_metrics
            WHERE window_5min = (
                SELECT MAX(window_5min)
                FROM danonedemo_catalog.digital_twin.gold_equipment_metrics
            )
        ) m ON e.equipment_id = m.equipment_id
        ORDER BY e.plant_id, e.equipment_type
        """

        batch_sql = """
        SELECT
            batch_id,
            plant_id,
            line_ids,
            COALESCE(CAST(avg_moisture_pct AS DOUBLE), 0.0)        AS avg_moisture_pct,
            COALESCE(CAST(avg_protein_pct AS DOUBLE), 0.0)         AS avg_protein_pct,
            COALESCE(CAST(avg_fat_pct AS DOUBLE), 0.0)             AS avg_fat_pct,
            COALESCE(CAST(ftr_rate_pct AS DOUBLE), 0.0)            AS ftr_rate_pct,
            COALESCE(CAST(total_energy_kwh AS DOUBLE), 0.0)        AS total_energy_kwh,
            COALESCE(CAST(moisture_compliance_pct AS DOUBLE), 0.0) AS moisture_compliance_pct
        FROM danonedemo_catalog.digital_twin.gold_batch_yield
        ORDER BY batch_first_seen DESC
        LIMIT 15
        """

        edges_sql = """
        SELECT DISTINCT
            batch_id,
            equipment_id,
            equipment_name,
            equipment_type,
            COUNT(*) AS event_count
        FROM danonedemo_catalog.digital_twin.silver_twin_events
        WHERE batch_id IS NOT NULL
          AND equipment_id IS NOT NULL
          AND event_ts >= current_timestamp() - INTERVAL 2 HOURS
        GROUP BY batch_id, equipment_id, equipment_name, equipment_type
        ORDER BY event_count DESC
        LIMIT 100
        """

        equipment_rows = execute_sql(equipment_sql)
        batch_rows = execute_sql(batch_sql)
        edge_rows = execute_sql(edges_sql)

        equipment_nodes = [
            {
                "id": r["equipment_id"],
                "type": "equipment",
                "label": r["equipment_name"],
                "equipment_type": r["equipment_type"],
                "plant_id": r["plant_id"],
                "line_id": r["line_id"],
                "metrics": {
                    "avg_temperature_c": r.get("avg_temperature_c"),
                    "total_energy_kwh": r.get("total_energy_kwh"),
                    "alarm_count": r.get("alarm_count"),
                },
                "status": (
                    "alarm"   if (r.get("alarm_count") or 0) > 0
                    else "warning" if (r.get("avg_temperature_c") or 0) > 85
                    else "ok"
                ),
            }
            for r in equipment_rows
        ]

        batch_nodes = [
            {
                "id": r["batch_id"],
                "type": "batch",
                "label": r["batch_id"],
                "plant_id": r["plant_id"],
                "line_id": r["line_ids"],
                "metrics": {
                    "avg_moisture_pct": r.get("avg_moisture_pct"),
                    "avg_protein_pct": r.get("avg_protein_pct"),
                    "avg_fat_pct": r.get("avg_fat_pct"),
                    "ftr_rate_pct": r.get("ftr_rate_pct"),
                    "moisture_compliance_pct": r.get("moisture_compliance_pct"),
                },
                "status": (
                    "warning" if (r.get("moisture_compliance_pct") or 100) < 90
                    else "ok"
                ),
            }
            for r in batch_rows
        ]

        edges = [
            {
                "id": f"{r['batch_id']}->{r['equipment_id']}",
                "source": r["batch_id"],
                "target": r["equipment_id"],
                "label": "processed_by",
                "event_count": r.get("event_count"),
            }
            for r in edge_rows
        ]

        return {"nodes": batch_nodes + equipment_nodes, "edges": edges}

    except Exception as exc:
        return _error(exc)
