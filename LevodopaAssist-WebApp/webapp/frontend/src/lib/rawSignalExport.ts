import { COMPARISON_METRIC_KEYS, METRIC_LABELS, type Measurement } from "../types";

function sanitizeForFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "").trim();
}

function measurementFileBase(patientName: string, measurement: Measurement): string {
  const seq = String(measurement.sequenceNumber).padStart(2, "0");
  return `${sanitizeForFilename(patientName)}_Medición${seq}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function roundForExport(value: number | null): number | string {
  if (value == null) return "";
  // Redondeo a 2 decimales solo para que se lea bien en una planilla: los valores que ya son
  // enteros (conteos, mV, ms) no cambian, y las métricas derivadas dejan de arrastrar 12+
  // decimales de coma flotante.
  return Math.round(value * 100) / 100;
}

/**
 * Exporta TODO lo que se transmitió/calculó en la medición (no solo la señal cruda): datos del
 * paciente/medición, el resumen completo (incluidas las métricas derivadas), el detalle de cada
 * contracción y la secuencia completa de muestras crudas. La idea es poder llevarse un solo
 * archivo y usarlo para simular/probar un algoritmo nuevo por fuera del dispositivo, con datos
 * reales de un paciente.
 *
 * Formato: 4 bloques separados por una línea en blanco, cada uno con su propia fila de
 * encabezado y columnas con sentido propio (no una sola tabla genérica "campo1/campo2/..."
 * mezclando filas de forma muy distinta). Para procesarlo por código, separar por líneas en
 * blanco (`contenido.split(/\r?\n\r?\n/)`) y descartar la primera línea "=== ... ===" de cada
 * bloque antes de parsear ese bloque como CSV.
 */
export function downloadRawSignalCsv(patientName: string, measurement: Measurement, samples: number[]) {
  // Separador ";" (no ",") porque Excel en configuración regional en español usa la coma
  // como separador decimal, y trata la coma como delimitador de columna solo en locales en inglés.
  // BOM (﻿) al inicio para que Excel detecte UTF-8 y muestre bien los acentos del encabezado.
  const blocks: string[][] = [
    [
      "=== DATOS DEL PACIENTE Y LA MEDICIÓN ===",
      "campo;valor",
      `paciente;${patientName}`,
      `medicion_id;${measurement.id}`,
      `secuencia;${measurement.sequenceNumber}`,
      `estado_medicacion;${measurement.medicationState}`,
      `fecha;${measurement.measuredAt}`,
      `lugar;${measurement.location ?? ""}`,
    ],
    [
      "=== RESUMEN DE LA MEDICIÓN ===",
      "variable;valor",
      ...COMPARISON_METRIC_KEYS.map(
        (key) => `${METRIC_LABELS[key]};${roundForExport(measurement[key])}`
      ),
    ],
    [
      "=== CONTRACCIONES DETECTADAS ===",
      "numero;amplitud_mV;duracion_ms",
      ...(measurement.contractions ?? []).map(
        (c) => `${c.sequenceIndex + 1};${c.amplitude};${c.durationMs}`
      ),
    ],
    [
      "=== SEÑAL CRUDA (una muestra por fila, en el orden en que llegó) ===",
      "indice;valor_mV",
      ...samples.map((v, i) => `${i};${v}`),
    ],
  ];

  const csv = "﻿" + blocks.map((block) => block.join("\r\n")).join("\r\n\r\n");
  triggerDownload(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    `${measurementFileBase(patientName, measurement)}.csv`
  );
}

export function downloadRawSignalJson(patientName: string, measurement: Measurement, samples: number[]) {
  const payload = {
    measurementId: measurement.id,
    sequenceNumber: measurement.sequenceNumber,
    patientId: measurement.patientId,
    patientName,
    medicationState: measurement.medicationState,
    measuredAt: measurement.measuredAt,
    location: measurement.location,
    notes: measurement.notes,
    summary: Object.fromEntries(
      COMPARISON_METRIC_KEYS.map((key) => [key, measurement[key]])
    ),
    contractions: (measurement.contractions ?? []).map((c) => ({
      sequenceIndex: c.sequenceIndex,
      amplitude: c.amplitude,
      durationMs: c.durationMs,
    })),
    sampleCount: samples.length,
    note: "Muestras crudas indexadas secuencialmente (eje X = índice de muestra). El firmware no reporta una tasa de muestreo fija. Incluye el detalle de cada contracción y el resumen final para poder simular/probar algoritmos nuevos con estos datos como si estuvieran llegando en vivo.",
    samples,
  };
  triggerDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `${measurementFileBase(patientName, measurement)}.json`
  );
}
