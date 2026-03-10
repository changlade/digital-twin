-- ============================================================
-- Bronze Layer: Raw streaming events from factory sensors
-- Danone Bio-Mechanical Yield & Sustainability Digital Twin
-- ============================================================
-- Ingests JSON files written every second by the event generator
-- into a UC volume using Lakeflow Auto Loader (STREAM read_files).
-- streaming_events_path is injected via pipeline configuration:
--   /Volumes/<catalog>/<schema>/<volume>/streaming_events
-- ============================================================

CREATE OR REPLACE STREAMING TABLE bronze_twin_events
CLUSTER BY (plant_id, equipment_type)
COMMENT 'Raw streaming sensor events from Danone factories (spray dryers, mixers, CIP units, etc.) - one row per event, ingested via Auto Loader from UC volume'
AS
SELECT
  event_id,
  CAST(event_ts AS TIMESTAMP)            AS event_ts,
  event_type,
  equipment_id,
  equipment_name,
  equipment_type,
  line_id,
  plant_id,
  batch_id,
  -- Mechanical parameters
  CAST(temperature_c AS DOUBLE)          AS temperature_c,
  CAST(inlet_temperature_c AS DOUBLE)    AS inlet_temperature_c,
  CAST(outlet_temperature_c AS DOUBLE)   AS outlet_temperature_c,
  CAST(pressure_kpa AS DOUBLE)           AS pressure_kpa,
  CAST(flow_rate_l_min AS DOUBLE)        AS flow_rate_l_min,
  CAST(mixing_speed_rpm AS DOUBLE)       AS mixing_speed_rpm,
  CAST(air_flow_m3_h AS DOUBLE)          AS air_flow_m3_h,
  CAST(powder_output_kg_h AS DOUBLE)     AS powder_output_kg_h,
  CAST(packing_speed_cans_min AS DOUBLE) AS packing_speed_cans_min,
  CAST(reject_rate_pct AS DOUBLE)        AS reject_rate_pct,
  -- Biological / quality parameters
  CAST(moisture_pct AS DOUBLE)           AS moisture_pct,
  CAST(viscosity_cp AS DOUBLE)           AS viscosity_cp,
  CAST(protein_pct AS DOUBLE)            AS protein_pct,
  CAST(fat_pct AS DOUBLE)                AS fat_pct,
  CAST(first_time_right AS BOOLEAN)      AS first_time_right,
  -- Sustainability parameters
  CAST(energy_kwh AS DOUBLE)             AS energy_kwh,
  CAST(water_liters AS DOUBLE)           AS water_liters,
  CAST(water_steam_liters AS DOUBLE)     AS water_steam_liters,
  CAST(chemical_consumption_l AS DOUBLE) AS chemical_consumption_l,
  -- Alarm fields
  alarm_code,
  alarm_severity,
  -- CIP-specific
  cip_phase,
  -- Metadata
  current_timestamp()                    AS _ingested_at,
  _metadata.file_path                    AS _source_file,
  _metadata.file_modification_time       AS _file_modified_at
FROM STREAM read_files(
  '${streaming_events_path}',
  format => 'json',
  schemaHints => '
    event_id STRING,
    event_ts STRING,
    event_type STRING,
    equipment_id STRING,
    equipment_name STRING,
    equipment_type STRING,
    line_id STRING,
    plant_id STRING,
    batch_id STRING,
    temperature_c DOUBLE,
    inlet_temperature_c DOUBLE,
    outlet_temperature_c DOUBLE,
    pressure_kpa DOUBLE,
    flow_rate_l_min DOUBLE,
    mixing_speed_rpm DOUBLE,
    air_flow_m3_h DOUBLE,
    powder_output_kg_h DOUBLE,
    packing_speed_cans_min DOUBLE,
    reject_rate_pct DOUBLE,
    moisture_pct DOUBLE,
    viscosity_cp DOUBLE,
    protein_pct DOUBLE,
    fat_pct DOUBLE,
    first_time_right BOOLEAN,
    energy_kwh DOUBLE,
    water_liters DOUBLE,
    water_steam_liters DOUBLE,
    chemical_consumption_l DOUBLE,
    alarm_code STRING,
    alarm_severity STRING,
    cip_phase STRING
  ',
  mode => 'PERMISSIVE'
);
