-- ============================================================
-- Gold Layer: Equipment-level operational metrics
-- Danone Bio-Mechanical Yield & Sustainability Digital Twin
-- ============================================================
-- Aggregates silver events by equipment and 5-minute time buckets.
-- Materialized View: refreshes on every pipeline trigger.
-- Powers "mechanical twin" KPIs: temperature, pressure, energy, alarms.
-- ============================================================

CREATE OR REPLACE MATERIALIZED VIEW gold_equipment_metrics
COMMENT 'Equipment KPIs aggregated by 5-minute buckets: temperature, pressure, energy, alarm counts'
AS
SELECT
  equipment_id,
  equipment_name,
  equipment_type,
  line_id,
  plant_id,
  TIMESTAMP_SECONDS(FLOOR(UNIX_SECONDS(event_ts) / 300) * 300)      AS window_5min,
  event_date,
  COUNT(*)                                  AS event_count,
  -- Temperature (mechanical twin)
  AVG(temperature_c)                        AS avg_temperature_c,
  MIN(temperature_c)                        AS min_temperature_c,
  MAX(temperature_c)                        AS max_temperature_c,
  AVG(inlet_temperature_c)                  AS avg_inlet_temp_c,
  AVG(outlet_temperature_c)                 AS avg_outlet_temp_c,
  -- Pressure
  AVG(pressure_kpa)                         AS avg_pressure_kpa,
  MAX(pressure_kpa)                         AS max_pressure_kpa,
  -- Flow
  AVG(flow_rate_l_min)                      AS avg_flow_rate_l_min,
  -- Sustainability metrics
  SUM(energy_kwh)                           AS total_energy_kwh,
  SUM(water_liters)                         AS total_water_liters,
  SUM(water_steam_liters)                   AS total_steam_liters,
  AVG(energy_kwh)                           AS avg_energy_kwh,
  -- Quality metrics (biological twin)
  AVG(moisture_pct)                         AS avg_moisture_pct,
  AVG(viscosity_cp)                         AS avg_viscosity_cp,
  AVG(protein_pct)                          AS avg_protein_pct,
  AVG(fat_pct)                              AS avg_fat_pct,
  AVG(powder_output_kg_h)                   AS avg_powder_output_kg_h,
  -- Alarm counts (fault propagation)
  SUM(CAST(is_alarm AS INT))                AS alarm_count,
  COUNT(DISTINCT CASE WHEN is_alarm THEN alarm_code END) AS distinct_alarm_types,
  -- First time right
  SUM(CAST(first_time_right AS INT))        AS ftr_pass_count,
  SUM(CAST(is_quality_check AS INT))        AS quality_check_count,
  CASE
    WHEN SUM(CAST(is_quality_check AS INT)) > 0
    THEN ROUND(
      100.0 * SUM(CAST(first_time_right AS INT))
            / SUM(CAST(is_quality_check AS INT)), 1)
    ELSE NULL
  END                                       AS ftr_rate_pct,
  current_timestamp()                       AS _computed_at
FROM silver_twin_events
WHERE event_type IN ('sensor_reading', 'alarm', 'quality_check')
GROUP BY
  equipment_id,
  equipment_name,
  equipment_type,
  line_id,
  plant_id,
  TIMESTAMP_SECONDS(FLOOR(UNIX_SECONDS(event_ts) / 300) * 300),
  event_date;
