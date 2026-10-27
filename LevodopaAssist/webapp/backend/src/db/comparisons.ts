import { supabase } from "./supabase";
import { mapMeasurement } from "./mappers";
import type { ComparisonMetrics } from "../services/comparison";
import type { ComparisonRow, Measurement, MeasurementContractionRow, MeasurementRow } from "./types";

type MeasurementEmbedRow = MeasurementRow & {
  measurement_contractions?: MeasurementContractionRow[] | null;
};

type ComparisonEmbedRow = ComparisonRow & {
  measurement_a: MeasurementEmbedRow;
  measurement_b: MeasurementEmbedRow;
};

export type ComparisonApi = {
  id: string;
  patientId: string;
  measurementAId: string;
  measurementBId: string;
  measurementA: Measurement;
  measurementB: Measurement;
  metricsJson: string;
  metrics: ComparisonMetrics;
  createdAt: string;
};

function mapComparison(row: ComparisonEmbedRow, omitRawSamples: boolean): ComparisonApi {
  const measurementA = mapMeasurement(row.measurement_a, {
    omitRawSamples,
    contractions: row.measurement_a.measurement_contractions ?? undefined,
  });
  const measurementB = mapMeasurement(row.measurement_b, {
    omitRawSamples,
    contractions: row.measurement_b.measurement_contractions ?? undefined,
  });

  if (omitRawSamples) {
    measurementA.rawSamplesJson = null;
    measurementB.rawSamplesJson = null;
  }

  return {
    id: row.id,
    patientId: row.patient_id,
    measurementAId: row.measurement_a_id,
    measurementBId: row.measurement_b_id,
    measurementA,
    measurementB,
    metricsJson: row.metrics_json,
    metrics: JSON.parse(row.metrics_json) as ComparisonMetrics,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** Select de A/B sin raw_samples_json (listado). */
const LIST_SELECT = `
  *,
  measurement_a:measurements!comparisons_measurement_a_id_fkey(
    id, patient_id, sequence_number, medication_state, measured_at, location, notes, status,
    con_num, timer_medicion_ms, con_x_minuto, peak_max, promedio_peaks, yyn, promedio_lth_ms,
    promedio_btw_ms, thresh, amplitude_decrement_pct, duration_decrement_pct, duration_cv_pct,
    peak_to_base_ratio, iemg, resting_tone_mv, incomplete_relaxation_pct, detection_source,
    detection_note, created_at
  ),
  measurement_b:measurements!comparisons_measurement_b_id_fkey(
    id, patient_id, sequence_number, medication_state, measured_at, location, notes, status,
    con_num, timer_medicion_ms, con_x_minuto, peak_max, promedio_peaks, yyn, promedio_lth_ms,
    promedio_btw_ms, thresh, amplitude_decrement_pct, duration_decrement_pct, duration_cv_pct,
    peak_to_base_ratio, iemg, resting_tone_mv, incomplete_relaxation_pct, detection_source,
    detection_note, created_at
  )
`;

const DETAIL_SELECT = `
  *,
  measurement_a:measurements!comparisons_measurement_a_id_fkey(*),
  measurement_b:measurements!comparisons_measurement_b_id_fkey(*)
`;

export async function listComparisonsForPatient(patientId: string): Promise<ComparisonApi[]> {
  const { data, error } = await supabase
    .from("comparisons")
    .select(LIST_SELECT)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as ComparisonEmbedRow[]).map((row) => mapComparison(row, true));
}

export async function getComparisonById(id: string): Promise<ComparisonApi | null> {
  const { data, error } = await supabase
    .from("comparisons")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapComparison(data as unknown as ComparisonEmbedRow, false);
}

export async function createComparison(input: {
  patientId: string;
  measurementAId: string;
  measurementBId: string;
  metrics: ComparisonMetrics;
}): Promise<ComparisonApi> {
  const { data, error } = await supabase
    .from("comparisons")
    .insert({
      patient_id: input.patientId,
      measurement_a_id: input.measurementAId,
      measurement_b_id: input.measurementBId,
      metrics_json: JSON.stringify(input.metrics),
    })
    .select(DETAIL_SELECT)
    .single();

  if (error) throw error;
  return mapComparison(data as unknown as ComparisonEmbedRow, false);
}

export async function getMeasurementRowForCompare(id: string): Promise<Measurement | null> {
  const { data, error } = await supabase.from("measurements").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapMeasurement(data as unknown as MeasurementRow);
}
