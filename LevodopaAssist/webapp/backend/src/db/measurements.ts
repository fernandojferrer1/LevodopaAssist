import { supabase } from "./supabase";
import {
  contractionsToRpcPayload,
  mapMeasurement,
  mapMeasurementListItem,
  measurementToRpcPayload,
} from "./mappers";
import type { Measurement, MeasurementContractionRow, MeasurementListItem, MeasurementRow } from "./types";
import { NotFoundError } from "./patients";

const MEASUREMENT_LIST_COLUMNS = [
  "id",
  "patient_id",
  "sequence_number",
  "medication_state",
  "measured_at",
  "location",
  "notes",
  "status",
  "con_num",
  "timer_medicion_ms",
  "con_x_minuto",
  "peak_max",
  "promedio_peaks",
  "yyn",
  "promedio_lth_ms",
  "promedio_btw_ms",
  "thresh",
  "amplitude_decrement_pct",
  "duration_decrement_pct",
  "duration_cv_pct",
  "peak_to_base_ratio",
  "iemg",
  "created_at",
].join(",");

type MeasurementWithContractionsRow = MeasurementRow & {
  measurement_contractions: MeasurementContractionRow[] | null;
};

export async function listMeasurementsForPatient(patientId: string): Promise<MeasurementListItem[]> {
  const { data, error } = await supabase
    .from("measurements")
    .select(MEASUREMENT_LIST_COLUMNS)
    .eq("patient_id", patientId)
    .order("measured_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as MeasurementRow[]).map(mapMeasurementListItem);
}

export async function getMeasurementById(id: string): Promise<Measurement | null> {
  const { data, error } = await supabase
    .from("measurements")
    .select("*, measurement_contractions(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as MeasurementWithContractionsRow;
  return mapMeasurement(row, {
    contractions: row.measurement_contractions ?? [],
  });
}

export type CreateMeasurementInput = {
  medicationState: string;
  measuredAt: string;
  location: string | null;
  notes: string | null;
  status: string;
  conNum: number;
  timerMedicionMs: number;
  conXMinuto: number;
  peakMax: number;
  promedioPeaks: number;
  yyn: number;
  promedioLthMs: number;
  promedioBtwMs: number;
  thresh: number;
  amplitudeDecrementPct: number | null;
  durationDecrementPct: number | null;
  durationCvPct: number | null;
  peakToBaseRatio: number | null;
  iemg: number | null;
  restingToneMv: number | null;
  incompleteRelaxationPct: number | null;
  detectionSource: string;
  detectionNote: string | null;
  rawSamplesJson: string | null;
  contractions: { amplitude: number; durationMs: number; truncated?: boolean }[];
};

export class PatientMissingError extends Error {
  constructor(message = "Paciente no encontrado") {
    super(message);
    this.name = "PatientMissingError";
  }
}

export async function createMeasurement(
  patientId: string,
  input: CreateMeasurementInput
): Promise<Measurement> {
  const { data: measurementId, error } = await supabase.rpc("create_measurement", {
    p_patient_id: patientId,
    p_measurement: measurementToRpcPayload(input),
    p_contractions: contractionsToRpcPayload(input.contractions),
  });

  if (error) {
    if (error.code === "P0002" || /patient not found/i.test(error.message)) {
      throw new PatientMissingError();
    }
    throw error;
  }

  const created = await getMeasurementById(measurementId as string);
  if (!created) {
    throw new Error("La medición se creó pero no se pudo releer");
  }
  return created;
}

export async function deleteMeasurement(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("delete_measurement", {
    p_measurement_id: id,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function assertMeasurementExists(id: string): Promise<void> {
  const { data, error } = await supabase.from("measurements").select("id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError("Medición no encontrada");
}
