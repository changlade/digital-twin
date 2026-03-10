-- ============================================================
-- Gold Layer: Batch yield and quality metrics
-- Danone Bio-Mechanical Yield & Sustainability Digital Twin
-- ============================================================
-- Aggregates per batch_id: biological quality (moisture, viscosity,
-- protein/fat) and associated mechanical conditions.
-- Enables "What-If" queries: did changing the dryer temperature for
-- batch X result in better moisture compliance?
-- ============================================================

CREATE OR REPLACE MATERIALIZED VIEW gold_batch_yield
COMMENT 'Per-batch yield and quality summary: biological variables vs. mechanical conditions; includes first-time-right rate and sustainability footprint per batch'
AS
SELECT
  batch_id,
  plant_id,
  -- Which equipment processed this batch
  COLLECT_SET(equipment_id)                  AS equipment_ids,
  COLLECT_SET(equipment_type)               AS equipment_types,
  COLLECT_SET(line_id)                      AS line_ids,
  -- Time range
  MIN(event_ts)                             AS batch_first_seen,
  MAX(event_ts)                             AS batch_last_seen,
  COUNT(*)                                  AS total_events,
  -- Biological quality metrics (spray dryer output)
  AVG(moisture_pct)                         AS avg_moisture_pct,
  MIN(moisture_pct)                         AS min_moisture_pct,
  MAX(moisture_pct)                         AS max_moisture_pct,
  STDDEV(moisture_pct)                      AS stddev_moisture_pct,
  AVG(viscosity_cp)                         AS avg_viscosity_cp,
  AVG(protein_pct)                          AS avg_protein_pct,
  AVG(fat_pct)                              AS avg_fat_pct,
  -- Moisture compliance (Danone Gold Standard: 3–5%)
  SUM(CASE WHEN moisture_quality = 'IN_SPEC'    THEN 1 ELSE 0 END) AS moisture_in_spec_count,
  SUM(CASE WHEN moisture_quality = 'OUT_OF_SPEC' THEN 1 ELSE 0 END) AS moisture_out_of_spec_count,
  ROUND(
    100.0 * SUM(CASE WHEN moisture_quality = 'IN_SPEC' THEN 1 ELSE 0 END)
          / NULLIF(SUM(CASE WHEN moisture_pct IS NOT NULL THEN 1 ELSE 0 END), 0),
    1
  )                                         AS moisture_compliance_pct,
  -- Mechanical conditions that produced this batch
  AVG(temperature_c)                        AS avg_process_temp_c,
  AVG(outlet_temperature_c)                 AS avg_outlet_temp_c,
  AVG(pressure_kpa)                         AS avg_pressure_kpa,
  AVG(powder_output_kg_h)                   AS avg_powder_output_kg_h,
  -- Sustainability footprint per batch
  SUM(energy_kwh)                           AS total_energy_kwh,
  SUM(water_liters)                         AS total_water_liters,
  -- First time right rate
  SUM(CAST(first_time_right AS INT))        AS ftr_pass_count,
  SUM(CAST(is_quality_check AS INT))        AS quality_checks,
  ROUND(
    100.0 * SUM(CAST(first_time_right AS INT))
          / NULLIF(SUM(CAST(is_quality_check AS INT)), 0),
    1
  )                                         AS ftr_rate_pct,
  -- Alarm count
  SUM(CAST(is_alarm AS INT))                AS alarm_count,
  current_timestamp()                       AS _computed_at
FROM silver_twin_events
WHERE batch_id IS NOT NULL
GROUP BY batch_id, plant_id;
