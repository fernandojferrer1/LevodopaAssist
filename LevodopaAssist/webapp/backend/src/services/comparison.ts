import type { Measurement } from "../db/types";

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

export type MetricComparison = {
  a: number | null;
  b: number | null;
  pctChange: number | null;
};

export type ComparisonMetrics = Record<ComparisonMetricKey, MetricComparison>;

export function computeComparisonMetrics(
  measurementA: Measurement,
  measurementB: Measurement
): ComparisonMetrics {
  const metrics = {} as ComparisonMetrics;

  for (const key of COMPARISON_METRIC_KEYS) {
    const a = measurementA[key];
    const b = measurementB[key];
    const pctChange = a == null || b == null || a === 0 ? null : ((b - a) / Math.abs(a)) * 100;
    metrics[key] = { a, b, pctChange };
  }

  return metrics;
}
