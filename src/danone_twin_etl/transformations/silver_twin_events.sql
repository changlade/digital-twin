-- ============================================================
-- Silver Layer: Cleaned and enriched streaming events
-- Danone Bio-Mechanical Yield & Sustainability Digital Twin
-- ============================================================
-- Reads from bronze_twin_events (streaming).
-- Filters nulls, adds derived columns: event_date, event_hour,
-- moisture quality flag, energy intensity bucket.
-- Note: event_ids are unique (UUID from generator), so no
-- explicit deduplication needed at this layer.
-- ============================================================

CREATE OR REPLACE STREAMING TABLE silver_twin_events
CLUSTER BY (plant_id, equipment_type, event_date)
COMMENT 'Cleaned and enriched sensor events with derived business flags for analysis'
AS
SELECT
  event_id,
  event_ts,
  event_type,
  equipment_id,
  equipment_name,
  equipment_type,
  line_id,
  plant_id,
  batch_id,
  -- Derived time columns
  CAST(event_ts AS DATE)                                AS event_date,
  HOUR(event_ts)                                        AS event_hour,
  DATE_TRUNC('hour',   event_ts)                        AS event_hour_ts,
  DATE_TRUNC('minute', event_ts)                        AS event_minute_ts,
  -- Mechanical parameters
  temperature_c,
  inlet_temperature_c,
  outlet_temperature_c,
  pressure_kpa,
  flow_rate_l_min,
  mixing_speed_rpm,
  air_flow_m3_h,
  powder_output_kg_h,
  packing_speed_cans_min,
  reject_rate_pct,
  -- Biological / quality parameters
  moisture_pct,
  viscosity_cp,
  protein_pct,
  fat_pct,
  first_time_right,
  -- Sustainability parameters
  energy_kwh,
  water_liters,
  water_steam_liters,
  chemical_consumption_l,
  -- Alarm fields
  alarm_code,
  alarm_severity,
  cip_phase,
  -- Derived flags
  (event_type = 'alarm')                                AS is_alarm,
  (event_type = 'quality_check')                        AS is_quality_check,
  (event_type IN ('batch_start', 'batch_end'))          AS is_batch_lifecycle,
  -- Moisture quality flag (Danone Gold Standard: 3–5%)
  CASE
    WHEN moisture_pct IS NULL              THEN NULL
    WHEN moisture_pct BETWEEN 3.0 AND 5.0  THEN 'IN_SPEC'
    WHEN moisture_pct BETWEEN 2.5 AND 5.5  THEN 'MARGINAL'
    ELSE                                        'OUT_OF_SPEC'
  END                                                   AS moisture_quality,
  -- Energy intensity bucket
  CASE
    WHEN energy_kwh IS NULL              THEN NULL
    WHEN energy_kwh < 50                 THEN 'LOW'
    WHEN energy_kwh BETWEEN 50 AND 200   THEN 'MEDIUM'
    ELSE                                      'HIGH'
  END                                                   AS energy_intensity,
  -- Metadata
  _ingested_at,
  _source_file,
  _file_modified_at
FROM STREAM bronze_twin_events
WHERE event_id IS NOT NULL
  AND event_ts IS NOT NULL;
