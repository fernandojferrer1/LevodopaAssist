import type {
  Measurement,
  MeasurementContraction,
  MeasurementContractionRow,
  MeasurementListItem,
  MeasurementRow,
  Patient,
  PatientRow,
} from "./types";

function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

export function mapPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    fullName: row.full_name,
    age: row.age,
    nationalId: row.national_id,
    diagnosis: row.diagnosis,
    notes: row.notes,
    extraFields: row.extra_fields,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapContraction(row: MeasurementContractionRow): MeasurementContraction {
  return {
    id: row.id,
    measurementId: row.measurement_id,
    sequenceIndex: row.sequence_index,
    amplitude: row.amplitude,
    durationMs: row.duration_ms,
    truncated: row.truncated,
  };
}

export function mapMeasurement(
  row: MeasurementRow,
  options?: { omitRawSamples?: boolean; contractions?: MeasurementContractionRow[] }
): Measurement {
  const measurement: Measurement = {
    id: row.id,
    patientId: row.patient_id,
    sequenceNumber: row.sequence_number,
    medicationState: row.medication_state as Measurement["medicationState"],
    measuredAt: toIso(row.measured_at),
    location: row.location,
    notes: row.notes,
    status: row.status as Measurement["status"],
    conNum: row.con_num,
    timerMedicionMs: row.timer_medicion_ms,
    conXMinuto: row.con_x_minuto,
    peakMax: row.peak_max,
    promedioPeaks: row.promedio_peaks,
    yyn: row.yyn,
    promedioLthMs: row.promedio_lth_ms,
    promedioBtwMs: row.promedio_btw_ms,
    thresh: row.thresh,
    amplitudeDecrementPct: row.amplitude_decrement_pct,
    durationDecrementPct: row.duration_decrement_pct,
    durationCvPct: row.duration_cv_pct,
    peakToBaseRatio: row.peak_to_base_ratio,
    iemg: row.iemg,
    restingToneMv: row.resting_tone_mv,
    incompleteRelaxationPct: row.incomplete_relaxation_pct,
    detectionSource: row.detection_source as Measurement["detectionSource"],
    detectionNote: row.detection_note,
    rawSamplesJson: options?.omitRawSamples ? null : (row.raw_samples_json ?? null),
    createdAt: toIso(row.created_at),
  };

  if (options?.contractions) {
    measurement.contractions = options.contractions
      .slice()
      .sort((a, b) => a.sequence_index - b.sequence_index)
      .map(mapContraction);
  }

  return measurement;
}

/** Misma forma que el select histórico de Prisma en GET /patients/:id/measurements. */
export function mapMeasurementListItem(row: MeasurementRow): MeasurementListItem {
  return {
    id: row.id,
    patientId: row.patient_id,
    sequenceNumber: row.sequence_number,
    medicationState: row.medication_state as Measurement["medicationState"],
    measuredAt: toIso(row.measured_at),
    location: row.location,
    notes: row.notes,
    status: row.status as Measurement["status"],
    conNum: row.con_num,
    timerMedicionMs: row.timer_medicion_ms,
    conXMinuto: row.con_x_minuto,
    peakMax: row.peak_max,
    promedioPeaks: row.promedio_peaks,
    yyn: row.yyn,
    promedioLthMs: row.promedio_lth_ms,
    promedioBtwMs: row.promedio_btw_ms,
    thresh: row.thresh,
    amplitudeDecrementPct: row.amplitude_decrement_pct,
    durationDecrementPct: row.duration_decrement_pct,
    durationCvPct: row.duration_cv_pct,
    peakToBaseRatio: row.peak_to_base_ratio,
    iemg: row.iemg,
    createdAt: toIso(row.created_at),
  };
}

/** Payload snake_case para RPC create_measurement (sin sequence_number). */
export function measurementToRpcPayload(input: {
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
}): Record<string, unknown> {
  return {
    medication_state: input.medicationState,
    measured_at: input.measuredAt,
    location: input.location,
    notes: input.notes,
    status: input.status,
    con_num: input.conNum,
    timer_medicion_ms: input.timerMedicionMs,
    con_x_minuto: input.conXMinuto,
    peak_max: input.peakMax,
    promedio_peaks: input.promedioPeaks,
    yyn: input.yyn,
    promedio_lth_ms: input.promedioLthMs,
    promedio_btw_ms: input.promedioBtwMs,
    thresh: input.thresh,
    amplitude_decrement_pct: input.amplitudeDecrementPct,
    duration_decrement_pct: input.durationDecrementPct,
    duration_cv_pct: input.durationCvPct,
    peak_to_base_ratio: input.peakToBaseRatio,
    iemg: input.iemg,
    resting_tone_mv: input.restingToneMv,
    incomplete_relaxation_pct: input.incompleteRelaxationPct,
    detection_source: input.detectionSource,
    detection_note: input.detectionNote,
    raw_samples_json: input.rawSamplesJson,
  };
}

export function contractionsToRpcPayload(
  contractions: { amplitude: number; durationMs: number; truncated?: boolean }[]
): Record<string, unknown>[] {
  return contractions.map((c, index) => ({
    sequence_index: index,
    amplitude: c.amplitude,
    duration_ms: c.durationMs,
    truncated: c.truncated ?? false,
  }));
}
