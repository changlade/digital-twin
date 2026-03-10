"""Batch yield quality endpoints."""
import traceback
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from databricks_client import execute_sql

router = APIRouter(tags=["batches"])


def _error(exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "traceback": traceback.format_exc()},
    )


@router.get("/batch-yield")
def get_batch_yield():
    try:
        sql = """
        SELECT
            batch_id,
            plant_id,
            line_ids,
            CAST(batch_first_seen AS STRING)        AS batch_first_seen,
            CAST(batch_last_seen AS STRING)         AS batch_last_seen,
            CAST(avg_moisture_pct AS DOUBLE)        AS avg_moisture_pct,
            CAST(moisture_compliance_pct AS DOUBLE) AS moisture_compliance_pct,
            CAST(avg_viscosity_cp AS DOUBLE)        AS avg_viscosity_cp,
            CAST(avg_protein_pct AS DOUBLE)         AS avg_protein_pct,
            CAST(avg_fat_pct AS DOUBLE)             AS avg_fat_pct,
            CAST(ftr_rate_pct AS DOUBLE)            AS ftr_rate_pct,
            CAST(total_energy_kwh AS DOUBLE)        AS total_energy_kwh,
            CAST(total_events AS INT)               AS event_count
        FROM danonedemo_catalog.digital_twin.gold_batch_yield
        ORDER BY batch_first_seen DESC
        LIMIT 20
        """
        rows = execute_sql(sql)
        return {"data": rows}
    except Exception as exc:
        return _error(exc)


@router.get("/batches-reference")
def get_batches_reference():
    try:
        sql = """
        SELECT *
        FROM danonedemo_catalog.digital_twin.raw_material_batches
        ORDER BY batch_id
        """
        rows = execute_sql(sql)
        return {"data": rows}
    except Exception as exc:
        return _error(exc)
