"""Equipment metrics endpoints."""
import traceback
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from databricks_client import execute_sql

router = APIRouter(tags=["equipment"])


def _error(exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "traceback": traceback.format_exc()},
    )


@router.get("/equipment-metrics")
def get_equipment_metrics():
    try:
        sql = """
        SELECT
            equipment_id,
            equipment_name,
            equipment_type,
            plant_id,
            line_id,
            CAST(window_5min AS STRING)        AS window_5min,
            CAST(avg_temperature_c AS DOUBLE)  AS avg_temperature_c,
            CAST(max_temperature_c AS DOUBLE)  AS max_temperature_c,
            CAST(total_energy_kwh AS DOUBLE)   AS total_energy_kwh,
            CAST(avg_flow_rate_l_min AS DOUBLE) AS avg_flow_rate_l_min,
            CAST(alarm_count AS INT)           AS alarm_count,
            CAST(event_count AS INT)           AS event_count
        FROM gold_equipment_metrics
        WHERE window_5min = (
            SELECT MAX(window_5min)
            FROM gold_equipment_metrics
        )
        ORDER BY plant_id, line_id, equipment_name
        """
        rows = execute_sql(sql)
        return {"data": rows}
    except Exception as exc:
        return _error(exc)


@router.get("/equipment-history/{equipment_id}")
def get_equipment_history(equipment_id: str, hours: int = 1):
    try:
        safe_id = equipment_id.replace("'", "''")
        sql = f"""
        SELECT
            CAST(window_5min AS STRING)        AS window_5min,
            CAST(avg_temperature_c AS DOUBLE)  AS avg_temperature_c,
            CAST(total_energy_kwh AS DOUBLE)   AS total_energy_kwh,
            CAST(alarm_count AS INT)           AS alarm_count,
            CAST(avg_flow_rate_l_min AS DOUBLE) AS avg_flow_rate_l_min
        FROM gold_equipment_metrics
        WHERE equipment_id = '{safe_id}'
          AND window_5min >= current_timestamp() - INTERVAL {int(hours)} HOURS
        ORDER BY window_5min ASC
        """
        rows = execute_sql(sql)
        return {"equipment_id": equipment_id, "data": rows}
    except Exception as exc:
        return _error(exc)


@router.get("/equipment-reference")
def get_equipment_reference():
    try:
        sql = """
        SELECT
            equipment_id,
            equipment_name,
            equipment_type,
            plant_id,
            line_id,
            location,
            capacity_lph,
            install_year
        FROM equipment
        ORDER BY plant_id, line_id, equipment_name
        """
        rows = execute_sql(sql)
        return {"data": rows}
    except Exception as exc:
        return _error(exc)
