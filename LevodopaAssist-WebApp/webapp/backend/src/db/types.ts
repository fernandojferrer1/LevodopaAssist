export type MedicationState = "sin_levodopa" | "post_levodopa";
export type MeasurementStatus = "completed" | "aborted";
export type DetectionSource = "firmware" | "backend";

/** Modelos de dominio (camelCase) — contrato de la API REST. */
export interface Patient {
  id: string;
  fullName: string;
  age: number;
  nationalId: string | null;
  diagnosis: string | null;
  notes: string | null;
  extraFields: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeasurementContraction {
  id: string;
  measurementId: string;
  sequenceIndex: number;
  amplitude: number;
  durationMs: number;
  truncated: boolean;
}

export interface Measurement {
  id: string;
  patientId: string;
  sequenceNumber: number;
  medicationState: MedicationState;
  measuredAt: string;
  location: string | null;
  notes: string | null;
  status: MeasurementStatus;
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
  detectionSource: DetectionSource;
  detectionNote: string | null;
  rawSamplesJson: string | null;
  createdAt: string;
  contractions?: MeasurementContraction[];
}

/** Fila de patients (snake_case). */
export interface PatientRow {
  id: string;
  full_name: string;
  age: number;
  national_id: string | null;
  diagnosis: string | null;
  notes: string | null;
  extra_fields: string | null;
  created_at: string;
  updated_at: string;
}

/** Fila de measurements (snake_case). */
export interface MeasurementRow {
  id: string;
  patient_id: string;
  sequence_number: number;
  medication_state: string;
  measured_at: string;
  location: string | null;
  notes: string | null;
  status: string;
  con_num: number;
  timer_medicion_ms: number;
  con_x_minuto: number;
  peak_max: number;
  promedio_peaks: number;
  yyn: number;
  promedio_lth_ms: number;
  promedio_btw_ms: number;
  thresh: number;
  amplitude_decrement_pct: number | null;
  duration_decrement_pct: number | null;
  duration_cv_pct: number | null;
  peak_to_base_ratio: number | null;
  iemg: number | null;
  resting_tone_mv: number | null;
  incomplete_relaxation_pct: number | null;
  detection_source: string;
  detection_note: string | null;
  raw_samples_json: string | null;
  created_at: string;
}

export interface MeasurementContractionRow {
  id: string;
  measurement_id: string;
  sequence_index: number;
  amplitude: number;
  duration_ms: number;
  truncated: boolean;
}

export interface ComparisonRow {
  id: string;
  patient_id: string;
  measurement_a_id: string;
  measurement_b_id: string;
  metrics_json: string;
  created_at: string;
}

export type MeasurementListItem = Omit<
  Measurement,
  | "rawSamplesJson"
  | "restingToneMv"
  | "incompleteRelaxationPct"
  | "detectionSource"
  | "detectionNote"
  | "contractions"
>;
