-- ============================================================
-- Gold Layer: Sustainability KPIs (Circular Water Twin)
-- Danone Bio-Mechanical Yield & Sustainability Digital Twin
-- ============================================================
-- Aggregates energy and water consumption by plant, line, and hour.
-- Materialized View: refreshes on every pipeline trigger.
-- Powers the "Circular Water Twin" demo:
--   - Identify CIP water overconsumption patterns
--   - Compare plant-level energy vs. powder output efficiency
--   - Real-time carbon footprint estimation
-- ============================================================

CREATE OR REPLACE MATERIALIZED VIEW gold_sustainability_hourly
COMMENT 'Hourly sustainability KPIs: energy (kWh), water (L), emissions estimate, and CIP-specific water tracking'
AS
SELECT
  plant_id,
  line_id,
  DATE_TRUNC('hour', event_ts)              AS hour_bucket,
  event_date,
  -- Event summary
  COUNT(*)                                  AS total_events,
  COUNT(DISTINCT equipment_id)              AS active_equipment_count,
  COUNT(DISTINCT batch_id)                  AS batches_processed,
  -- Energy footprint
  SUM(energy_kwh)                           AS total_energy_kwh,
  AVG(energy_kwh)                           AS avg_energy_kwh_per_event,
  -- Water footprint
  SUM(water_liters)                         AS total_water_liters,
  SUM(water_steam_liters)                   AS total_steam_water_liters,
  SUM(chemical_consumption_l)               AS total_chemical_liters,
  -- CIP-specific water (Circular Water Twin focus)
  SUM(CASE WHEN equipment_type = 'cip_unit'    THEN water_liters       ELSE 0 END) AS cip_water_liters,
  SUM(CASE WHEN equipment_type = 'spray_dryer' THEN water_steam_liters ELSE 0 END) AS dryer_steam_liters,
  -- Water efficiency ratio
  CASE
    WHEN SUM(powder_output_kg_h) > 0
    THEN ROUND(SUM(water_liters) / SUM(powder_output_kg_h), 2)
    ELSE NULL
  END                                       AS water_per_kg_powder_l,
  CASE
    WHEN SUM(powder_output_kg_h) > 0
    THEN ROUND(SUM(energy_kwh) / SUM(powder_output_kg_h), 3)
    ELSE NULL
  END                                       AS energy_per_kg_powder_kwh,
  -- Production output
  SUM(powder_output_kg_h)                   AS total_powder_output_kg,
  -- CO2 emissions estimate (EU grid average: ~0.233 kg CO2/kWh)
  ROUND(SUM(energy_kwh) * 0.233, 2)        AS estimated_co2_kg,
  -- Alarm summary
  SUM(CAST(is_alarm AS INT))                AS alarm_count,
  SUM(CASE WHEN alarm_code = 'WATER_OVERCONSUMPTION' THEN 1 ELSE 0 END) AS water_alarm_count,
  SUM(CASE WHEN alarm_code = 'MOISTURE_OUT_OF_SPEC'  THEN 1 ELSE 0 END) AS moisture_alarm_count,
  current_timestamp()                       AS _computed_at
FROM silver_twin_events
GROUP BY
  plant_id,
  line_id,
  DATE_TRUNC('hour', event_ts),
  event_date;
