"""What-If simulation endpoint."""
from __future__ import annotations
import traceback
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from databricks_client import execute_sql

router = APIRouter(tags=["simulate"])

CO2_KG_PER_KWH = 0.233
FAT_ENERGY_COEFF = 0.042
PROTEIN_VISCOSITY_COEFF = 1.8
VISCOSITY_ENERGY_COEFF = 0.003
TEMP_QUALITY_COEFF = 0.6
TEMP_ENERGY_COEFF = 0.018


def _error(exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "traceback": traceback.format_exc()},
    )


class SimulationRequest(BaseModel):
    batch_id: str = Field(..., description="Reference batch to simulate against")
    fat_delta_pct: float = Field(0.0, ge=-1.0, le=1.0)
    protein_delta_pct: float = Field(0.0, ge=-1.0, le=1.0)
    heat_setting_c: float = Field(72.0, ge=60.0, le=95.0)


@router.post("/simulate")
def run_simulation(req: SimulationRequest):
    try:
        safe_id = req.batch_id.replace("'", "''")
        sql = f"""
        SELECT
            batch_id,
            CAST(avg_moisture_pct AS DOUBLE)  AS avg_moisture_pct,
            CAST(avg_viscosity_cp AS DOUBLE)  AS avg_viscosity_cp,
            CAST(avg_protein_pct AS DOUBLE)   AS avg_protein_pct,
            CAST(avg_fat_pct AS DOUBLE)       AS avg_fat_pct,
            CAST(total_energy_kwh AS DOUBLE)  AS total_energy_kwh,
            CAST(ftr_rate_pct AS DOUBLE)      AS ftr_rate_pct,
            CAST(alarm_count AS INT)          AS alarm_count
        FROM danonedemo_catalog.digital_twin.gold_batch_yield
        WHERE batch_id = '{safe_id}'
        LIMIT 1
        """
        rows = execute_sql(sql)
        if not rows:
            return JSONResponse(
                status_code=404,
                content={"error": f"Batch '{req.batch_id}' not found."},
            )

        baseline = rows[0]
        base_energy = float(baseline.get("total_energy_kwh") or 0)
        base_viscosity = float(baseline.get("avg_viscosity_cp") or 50)
        base_fat = float(baseline.get("avg_fat_pct") or 3.5)
        base_protein = float(baseline.get("avg_protein_pct") or 3.2)
        base_ftr = float(baseline.get("ftr_rate_pct") or 95)
        alarm_count = int(baseline.get("alarm_count") or 10)
        volume_kl = max(alarm_count * 0.5, 1.0)

        fat_energy_delta = req.fat_delta_pct * FAT_ENERGY_COEFF * volume_kl
        new_viscosity = base_viscosity + req.protein_delta_pct * PROTEIN_VISCOSITY_COEFF * 10
        viscosity_energy_delta = (new_viscosity - base_viscosity) * VISCOSITY_ENERGY_COEFF * volume_kl
        heat_delta = req.heat_setting_c - 72.0
        heat_energy_delta = heat_delta * TEMP_ENERGY_COEFF * volume_kl
        texture_quality_gain = heat_delta * TEMP_QUALITY_COEFF
        fat_quality_gain = req.fat_delta_pct * 3.5

        total_energy_delta = fat_energy_delta + viscosity_energy_delta + heat_energy_delta
        new_energy = max(base_energy + total_energy_delta, 0)
        new_co2 = new_energy * CO2_KG_PER_KWH
        base_co2 = base_energy * CO2_KG_PER_KWH
        base_quality = 75.0
        new_quality = min(100.0, max(0.0, base_quality + texture_quality_gain + fat_quality_gain))
        energy_pct_change = ((new_energy - base_energy) / base_energy * 100) if base_energy else 0

        if energy_pct_change < -5 and new_quality >= base_quality:
            recommendation = "Optimal: lower energy with maintained quality."
        elif energy_pct_change > 10:
            recommendation = "Caution: significant energy cost increase. Consider reducing heat setting."
        elif new_quality > base_quality + 5:
            recommendation = "Quality improved. Monitor energy use vs. margin gain."
        elif new_quality < base_quality - 5:
            recommendation = "Quality degraded below threshold. Adjust protein or heat setting."
        else:
            recommendation = "Minor parameter change — within operational tolerance."

        return {
            "batch_id": req.batch_id,
            "inputs": {
                "fat_delta_pct": req.fat_delta_pct,
                "protein_delta_pct": req.protein_delta_pct,
                "heat_setting_c": req.heat_setting_c,
            },
            "baseline": {
                "fat_pct": base_fat,
                "protein_pct": base_protein,
                "viscosity_cp": base_viscosity,
                "energy_kwh": round(base_energy, 2),
                "co2_kg": round(base_co2, 2),
                "quality_score": round(base_quality, 1),
                "ftr_rate_pct": round(base_ftr, 1),
            },
            "simulated": {
                "fat_pct": round(base_fat + req.fat_delta_pct, 2),
                "protein_pct": round(base_protein + req.protein_delta_pct, 2),
                "viscosity_cp": round(new_viscosity, 1),
                "energy_kwh": round(new_energy, 2),
                "co2_kg": round(new_co2, 2),
                "quality_score": round(new_quality, 1),
            },
            "deltas": {
                "energy_kwh": round(total_energy_delta, 2),
                "energy_pct": round(energy_pct_change, 1),
                "co2_kg": round(new_co2 - base_co2, 2),
                "quality_score": round(new_quality - base_quality, 1),
            },
            "recommendation": recommendation,
        }
    except Exception as exc:
        return _error(exc)


@router.get("/simulate/batches")
def list_simulatable_batches():
    try:
        sql = """
        SELECT batch_id, plant_id,
               CAST(avg_fat_pct AS DOUBLE)     AS avg_fat_pct,
               CAST(avg_protein_pct AS DOUBLE) AS avg_protein_pct,
               CAST(ftr_rate_pct AS DOUBLE)    AS ftr_rate_pct
        FROM danonedemo_catalog.digital_twin.gold_batch_yield
        ORDER BY batch_first_seen DESC
        LIMIT 15
        """
        rows = execute_sql(sql)
        return {"data": rows}
    except Exception as exc:
        return _error(exc)
