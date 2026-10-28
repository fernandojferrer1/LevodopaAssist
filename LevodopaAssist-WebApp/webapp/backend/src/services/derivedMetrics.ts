// ============================================================================
// derivedMetrics.ts - Métricas clínicas calculadas a partir de lo que ya se
// guarda de cada medición (contracciones detectadas + señal cruda). No
// requieren cambios en el firmware: toda la información ya viaja por Serial
// y ya se persiste en la base.
// ============================================================================

export interface ContractionInput {
  amplitude: number;
  durationMs: number;
  /**
   * true = la ventana de medición cortó esta contracción por la mitad. Su amplitud
   * y su duración no son medidas reales, así que queda fuera de todas las métricas
   * de abajo. Ver el detalle en contractionDetection.ts.
   */
  truncated?: boolean;
}

export interface DerivedMetrics {
  amplitudeDecrementPct: number | null;
  durationDecrementPct: number | null;
  durationCvPct: number | null;
  peakToBaseRatio: number | null;
  iemg: number | null;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Desvío estándar muestral (n-1). Requiere al menos 2 valores. */
function sampleStdDev(values: number[], avg: number): number {
  const sumSq = values.reduce((sum, v) => sum + (v - avg) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

/**
 * % de cambio entre el promedio del primer tercio y el del último tercio de
 * la secuencia (en orden de detección). Es el marcador de "sequence effect"
 * de bradicinesia: la caída de amplitud/duración a medida que se repite el
 * movimiento. Null si hay menos de 2 contracciones (no hay "antes" y
 * "después" que comparar).
 */
function decrementPct(valuesInOrder: number[]): number | null {
  if (valuesInOrder.length < 2) return null;

  const chunkSize = Math.max(1, Math.floor(valuesInOrder.length / 3));
  const firstChunk = valuesInOrder.slice(0, chunkSize);
  const lastChunk = valuesInOrder.slice(-chunkSize);

  const firstMean = mean(firstChunk);
  const lastMean = mean(lastChunk);
  if (firstMean === 0) return null;

  return ((lastMean - firstMean) / firstMean) * 100;
}

/**
 * Calcula las métricas derivadas de una medición. Se llama al crear la
 * medición (POST /measurements) y el resultado se persiste junto con el
 * resto de los campos, para no tener que recalcular en cada lectura.
 */
export function computeDerivedMetrics(
  contractions: ContractionInput[],
  rawSamples: number[] | null,
  yyn: number,
  peakMax: number,
  timerMedicionMs: number
): DerivedMetrics {
  // Las contracciones truncadas por el final de la ventana se excluyen de TODAS las
  // métricas de forma y tamaño. No es una limpieza cosmética: su pico artificialmente
  // bajo cae siempre en el último tercio de la secuencia, que es justo el tercio con
  // el que se compara el primero para calcular el decremento. Medido sobre la
  // medición #8, incluirlas daba un decremento de amplitud de -2,3% donde el real es
  // +1,5%: el signo del marcador de bradicinesia se invertía.
  const medibles = contractions.filter((c) => !c.truncated);

  const amplitudes = medibles.map((c) => c.amplitude);
  const durations = medibles.map((c) => c.durationMs);

  const amplitudeDecrementPct = decrementPct(amplitudes);
  const durationDecrementPct = decrementPct(durations);

  let durationCvPct: number | null = null;
  if (durations.length >= 2) {
    const avgDuration = mean(durations);
    if (avgDuration !== 0) {
      durationCvPct = (sampleStdDev(durations, avgDuration) / avgDuration) * 100;
    }
  }

  const peakToBaseRatio = yyn !== 0 ? peakMax / yyn : null;

  // iEMG aproximado: promedio de la señal (ya rectificada por la etapa analógica) por la
  // duración total de la ventana. Usar promedio*duración en vez de una simple suma de
  // muestras aproxima mejor una integral en el tiempo (mV·ms), porque el intervalo entre
  // muestras no es perfectamente constante (varía con el tiempo de conversión del ADC).
  const iemg =
    rawSamples && rawSamples.length > 0 ? mean(rawSamples) * timerMedicionMs : null;

  return {
    amplitudeDecrementPct,
    durationDecrementPct,
    durationCvPct,
    peakToBaseRatio,
    iemg,
  };
}
