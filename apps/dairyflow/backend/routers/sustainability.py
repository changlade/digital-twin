"""Sustainability (energy / water / CO₂) endpoints."""
import traceback
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from databricks_client import execute_sql

router = APIRouter(tags=["sustainability"])

CO2_KG_PER_KWH = 0.233


def _error(exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "traceback": traceback.format_exc()},
    )


@router.get("/sustainability")
def get_sustainability(hours: int = 24):
    try:
        sql = f"""
        SELECT
            plant_id,
            line_id,
            CAST(hour_bucket AS STRING)        AS hour_bucket,
            CAST(total_energy_kwh AS DOUBLE)   AS total_energy_kwh,
            CAST(cip_water_liters AS DOUBLE)   AS cip_water_liters,
            CAST(total_water_liters AS DOUBLE) AS total_water_liters,
            CAST(estimated_co2_kg AS DOUBLE)   AS estimated_co2_kg,
            CAST(water_alarm_count AS INT)     AS water_alarm_count,
            CAST(total_events AS INT)          AS event_count
        FROM gold_sustainability_hourly
        WHERE hour_bucket >= current_timestamp() - INTERVAL {int(hours)} HOURS
        ORDER BY hour_bucket DESC
        """
        rows = execute_sql(sql)
        return {"data": rows}
    except Exception as exc:
        return _error(exc)


@router.get("/sustainability-summary")
def get_sustainability_summary():
    try:
        sql = """
        SELECT
            plant_id,
            CAST(SUM(total_energy_kwh) AS DOUBLE)   AS total_energy_kwh,
            CAST(SUM(total_water_liters) AS DOUBLE)  AS total_water_liters,
            CAST(SUM(cip_water_liters) AS DOUBLE)    AS cip_water_liters,
            CAST(SUM(estimated_co2_kg) AS DOUBLE)    AS estimated_co2_kg,
            CAST(SUM(water_alarm_count) AS INT)      AS water_alarm_count
        FROM gold_sustainability_hourly
        GROUP BY plant_id
        ORDER BY plant_id
        """
        rows = execute_sql(sql)
        return {"data": rows}
    except Exception as exc:
        return _error(exc)


@router.get("/batch-carbon-traceback")
def get_batch_carbon_traceback():
    try:
        sql = """
        SELECT
            batch_id,
            plant_id,
            line_ids,
            CAST(avg_protein_pct AS DOUBLE)  AS avg_protein_pct,
            CAST(avg_fat_pct AS DOUBLE)      AS avg_fat_pct,
            CAST(avg_viscosity_cp AS DOUBLE) AS avg_viscosity_cp,
            CAST(total_energy_kwh AS DOUBLE) AS total_energy_kwh,
            CAST(ftr_rate_pct AS DOUBLE)     AS ftr_rate_pct,
            CAST(batch_first_seen AS STRING) AS batch_first_seen,
            CAST(avg_moisture_pct AS DOUBLE) AS avg_moisture_pct,
            CAST(moisture_compliance_pct AS DOUBLE) AS moisture_compliance_pct,
            CAST(total_events AS INT) AS event_count
        FROM gold_batch_yield
        ORDER BY batch_first_seen DESC
        LIMIT 20
        """
        rows = execute_sql(sql)

        if rows:
            avg_energy = sum(r.get("total_energy_kwh") or 0 for r in rows) / len(rows)
            for row in rows:
                energy = row.get("total_energy_kwh") or 0
                row["estimated_co2_kg"] = round(energy * CO2_KG_PER_KWH, 2)
                row["co2_vs_avg_pct"] = round(
                    ((energy - avg_energy) / avg_energy * 100) if avg_energy else 0, 1
                )

        return {"data": rows, "emission_factor": CO2_KG_PER_KWH}
    except Exception as exc:
        return _error(exc)
