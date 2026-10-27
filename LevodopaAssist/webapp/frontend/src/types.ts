export type MedicationState = "sin_levodopa" | "post_levodopa";

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
}

export interface Measurement {
  id: string;
  patientId: string;
  sequenceNumber: number;
  medicationState: MedicationState;
  measuredAt: string;
  location: string | null;
  notes: string | null;
  status: "completed" | "aborted";

  conNum: number;
  timerMedicionMs: number;
  conXMinuto: number;
  peakMax: number;
  promedioPeaks: number;
  yyn: number;
  promedioLthMs: number;
  promedioBtwMs: number;
  thresh: number;

  // Métricas derivadas, calculadas en el backend (no las manda el firmware). Null cuando no se
  // pueden calcular: menos de 2 contracciones detectadas (decremento/CV) o sin señal cruda
  // guardada (iemg), y en mediciones guardadas antes de agregar estos campos.
  amplitudeDecrementPct: number | null;
  durationDecrementPct: number | null;
  durationCvPct: number | null;
  peakToBaseRatio: number | null;
  iemg: number | null;

  rawSamplesJson?: string | null;
  createdAt: string;
  contractions?: MeasurementContraction[];
}

export const COMPARISON_METRIC_KEYS = [
  "conNum",
  "timerMedicionMs",
  "conXMinuto",
  "peakMax",
  "promedioPeaks",
  "yyn",
  "promedioLthMs",
  "promedioBtwMs",
  "thresh",
  "amplitudeDecrementPct",
  "durationDecrementPct",
  "durationCvPct",
  "peakToBaseRatio",
  "iemg",
] as const;

export type ComparisonMetricKey = (typeof COMPARISON_METRIC_KEYS)[number];

export const METRIC_LABELS: Record<ComparisonMetricKey, string> = {
  conNum: "N° de contracciones",
  timerMedicionMs: "Duración de la medición (ms)",
  conXMinuto: "Contracciones por minuto",
  peakMax: "Amplitud máxima de pico (mV)",
  promedioPeaks: "Promedio de amplitud de picos (mV)",
  yyn: "Valor base / reposo (mV)",
  promedioLthMs: "Duración promedio de contracción (ms)",
  promedioBtwMs: "Tiempo promedio entre contracciones (ms)",
  thresh: "Umbral usado (mV)",
  amplitudeDecrementPct: "Decremento de amplitud (1er vs. último tercio, %)",
  durationDecrementPct: "Decremento de duración (1er vs. último tercio, %)",
  durationCvPct: "Variabilidad de duración (CV, %)",
  peakToBaseRatio: "Relación pico / base",
  iemg: "Actividad muscular total (iEMG, mV·ms)",
};

export interface MetricComparison {
  a: number | null;
  b: number | null;
  pctChange: number | null;
}

export type ComparisonMetrics = Record<ComparisonMetricKey, MetricComparison>;

export interface Comparison {
  id: string;
  patientId: string;
  measurementAId: string;
  measurementBId: string;
  measurementA: Measurement;
  measurementB: Measurement;
  metrics: ComparisonMetrics;
  createdAt: string;
}
