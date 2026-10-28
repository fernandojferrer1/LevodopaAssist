// ============================================================================
// contractionDetection.ts - Detección de contracciones sobre la señal grabada
// ============================================================================
// Detecta las contracciones a partir de `rawSamplesJson`, la envolvente completa
// de los 10s de medición que ya se persiste en la base.
//
// POR QUÉ ACÁ Y NO SOLO EN EL FIRMWARE
//
// El equipo tiene que decidir en tiempo real, con un umbral fijado ANTES de
// medir a partir de 2s de calibración. Acá tenemos la medición entera y ningún
// límite de tiempo, así que el umbral se puede calcular sobre los mismos datos
// que se van a analizar. Eso hace que los números clínicos dejen de depender de
// que la calibración del equipo haya salido bien, y permite recalcular
// mediciones ya tomadas cuando se ajusta el método.
//
// El firmware sigue detectando por su cuenta: eso es lo que maneja el LED y el
// conteo en vivo durante la medición. Las dos implementaciones usan la misma
// lógica (percentiles + histéresis) para que no se contradigan.
//
// EL MÉTODO
//
// Se estiman dos niveles por separado, por percentiles:
//   reposo = p10 de la señal   (las contracciones no lo mueven: aun ocupando el
//                               40% de las muestras, el 10% más bajo es reposo)
//   pico   = p90 de la señal   (el nivel que alcanzan las contracciones)
// y el umbral se pone a una fracción de la amplitud entre ambos.
//
// La alternativa obvia (media + k*desvío sobre el reposo) es la que tenía el
// firmware y falla: ancla el umbral al RUIDO en vez de a la señal. El desvío
// del reposo es chico (92 mV medidos sobre Medición06), así que el margen que
// produce es frágil, y si la ventana llega a incluir una contracción el desvío
// se multiplica por 4 o 5 y el umbral se va por encima del máximo alcanzable.
// Eso es exactamente lo que pasó en Medición06: umbral 2942 mV contra un máximo
// de señal de 2616 mV, 0 contracciones detectadas sobre 15 reales.
//
// Anclar a la amplitud además resuelve el requisito de que el mismo equipo
// sirva para una persona sana (contracciones grandes y parejas) y para una con
// Parkinson (más chicas y deformadas): el umbral es siempre una fracción de la
// amplitud DE ESA PERSONA, así que la sensibilidad relativa es la misma sin
// tocar ninguna constante.

/** Percentil bajo: estima el nivel de reposo. */
const PERCENTIL_REPOSO = 0.1;

/** Percentil alto: estima el nivel que alcanzan las contracciones. */
const PERCENTIL_PICO = 0.9;

/**
 * Umbral de apertura, como fracción de la amplitud (pico - reposo).
 *
 * 0,30 es deliberadamente bajo. Si el paciente decrementa hasta el 40% de su
 * amplitud inicial, esas contracciones débiles SIGUEN cruzando el umbral y
 * quedan registradas. Con 0,50 se perderían - y perder las contracciones
 * decrementadas es perder justo el dato clínico que se busca medir, porque el
 * decremento de amplitud es el marcador de bradicinesia.
 *
 * Verificado sobre Medición06: cualquier umbral entre 1450 y 2375 mV devuelve
 * las mismas 15 contracciones. Con reposo 1349 y pico ~2500, la fracción 0,30
 * cae en 1694 mV, cómodo en el medio de esa meseta.
 */
const FRACCION_UMBRAL_APERTURA = 0.3;

/** Umbral de cierre (histéresis), como fracción de la misma amplitud. */
const FRACCION_UMBRAL_CIERRE = 0.15;

/**
 * Tiempo mínimo (ms) por debajo del umbral de cierre para dar una contracción
 * por terminada. Evita que una fluctuación breve parta una contracción en dos.
 * Mismo valor que `minBelowCloseMs` en el firmware.
 */
const MS_MINIMO_BAJO_CIERRE = 100;

/**
 * Duración mínima (ms) para aceptar una contracción. Por debajo de esto es
 * ruido o un movimiento del cable, no un apriete voluntario.
 */
const DURACION_MINIMA_MS = 80;

/** Amplitud mínima (mV) entre reposo y pico para que la señal sea analizable. */
const AMPLITUD_MINIMA_MV = 300;

/**
 * Umbral de "pie", como fracción de la amplitud: hasta dónde llega la contracción
 * por abajo. Todo lo que esté por encima de este nivel y pegado a una contracción
 * detectada es flanco de subida o de bajada, o sea parte de la contracción.
 *
 * Se usa para separar los dos niveles de reposo que hasta ahora estaban mezclados
 * en un solo número (ver restingFloor y restingTone abajo). Mismo valor que
 * `fraccionPieReposo` en el firmware, para que ambos midan lo mismo.
 */
const FRACCION_PIE = 0.1;

/**
 * Salto máximo admisible entre muestras consecutivas, como fracción de la
 * amplitud. Sirve para rechazar mediciones que NO son una envolvente.
 *
 * Las mediciones anteriores al 16/09/2026 se tomaron con un firmware que
 * mandaba la señal cruda a 71,4 Hz, con Nyquist en 35,7 Hz y la red de 50 Hz
 * plegada adentro de la banda útil. Sobre esas señales este detector produce
 * números con cara de válidos pero sin sentido: duraciones de 3 a 5 segundos
 * para aprietes que fueron de ~300 ms, porque la histéresis no llega a cerrar
 * entre un pico de ruido y el siguiente.
 *
 * Medido: la envolvente de v3D salta 52 mV entre muestras sobre una amplitud
 * de 1203 mV (4,3%). Las mediciones crudas saltan 425-490 mV sobre amplitudes
 * de 1800-2400 mV (20-25%). El corte en 10% separa los dos casos con margen.
 */
const MAX_SALTO_FRACCION = 0.1;

export interface DetectedContraction {
  /** Valor máximo de la envolvente durante la contracción, en mV. */
  amplitude: number;
  durationMs: number;
  /** Instante de inicio, en ms desde el comienzo de la medición. */
  startMs: number;
  /**
   * true = la ventana de medición cortó esta contracción antes de que terminara
   * (o ya estaba en curso cuando arrancó la grabación).
   *
   * Su `durationMs` NO es cuánto duró la contracción, es cuánto faltaba para que
   * terminara la grabación, y su `amplitude` puede no haber llegado al pico. Por
   * eso queda fuera de todas las estadísticas de amplitud y duración, aunque se
   * sigue contando: la contracción ocurrió, así que cuenta para el total y para
   * las contracciones por minuto.
   *
   * MEDIDO sobre las mediciones #7 y #8 del 16/09/2026: en las dos la última
   * contracción termina exactamente en el milisegundo 10000. Con contracciones
   * cada ~650 ms en una ventana de 10 s, la ventana corta una contracción por la
   * mitad en alrededor del 60% de las mediciones.
   *
   * El daño estaba en el decremento, que es el marcador de bradicinesia: una
   * contracción truncada tiene un pico artificialmente bajo y cae en el último
   * tercio, así que arrastra ese promedio hacia abajo y fabrica un decremento que
   * no existe. En #8 el decremento de amplitud pasaba de +1,5% (real) a -2,3%
   * (con la truncada), o sea que cambiaba de signo. El de duración se movía de
   * 22,3% a 5,0%.
   */
  truncated: boolean;
}

export interface DetectionResult {
  contractions: DetectedContraction[];
  /**
   * PISO de reposo (p10), en mV. Es el nivel cuando el músculo está realmente
   * quieto, y funciona como REFERENCIA: la amplitud de cada contracción y la
   * relación pico/base se miden desde acá, así que tiene que estar lo más limpio
   * posible de artefactos. Es el mismo valor que se guarda como `yyn`.
   */
  baseline: number;
  /**
   * TONO de reposo, en mV: nivel medio entre contracciones, ya sin los flancos de
   * subida y bajada. A diferencia del piso, esto no es una referencia sino una
   * MEDICIÓN: dice cuánto le falta al músculo para volver del todo antes del
   * siguiente apriete.
   *
   * Está siempre por encima del piso o igual. La diferencia entre ambos es
   * `incompleteRelaxationPct`.
   */
  restingTone: number;
  /**
   * (tono - piso) / amplitud, en %. Cuánto NO se relaja el músculo entre
   * contracciones.
   *
   * REFERENCIA MEDIDA en un sujeto sano (Fernando, 16/09/2026), sobre las tres
   * mediciones con envolvente de ese día: 2,5% (#6), 2,7% (#7) y 2,3% (#8).
   *
   * Es un rango estrecho, y lo notable es que la #6 cae adentro pese a tener peor
   * señal que las otras dos (reposo 1267 mV contra 877, y amplitud menor). O sea
   * que la métrica no se movió con la calidad de la adquisición, que era el riesgo
   * principal.
   *
   * ADVERTENCIA IGUAL: son tres mediciones de UNA sola persona sana, tomadas el
   * mismo día con el mismo electrodo. No hay ningún registro de un paciente con
   * Parkinson. Que el número sea estable acá no dice nada sobre si separa las dos
   * poblaciones. Se calcula y se guarda para ir juntando el dato, no para
   * interpretarlo todavía.
   */
  incompleteRelaxationPct: number | null;
  /** Nivel de contracción estimado (p90), en mV. */
  peakLevel: number;
  threshold: number;
  closeThreshold: number;
  /** Máximo absoluto de la señal, en mV. */
  peakMax: number;
  /**
   * false = la señal no se puede analizar con este método. Las contracciones
   * vienen vacías: es preferible no devolver nada a devolver números que
   * parecen válidos y no lo son.
   */
  usable: boolean;
  /** Por qué no es usable, para poder explicarlo en la UI. null si lo es. */
  reason: "sin_contraste" | "senal_sin_envolvente" | "muestras_insuficientes" | null;
  /** Salto medio entre muestras consecutivas, en mV. Diagnóstico de calidad. */
  meanStepMv: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * Detecta las contracciones de una medición a partir de la envolvente grabada.
 *
 * @param rawSamples  muestras en mV, en el orden en que llegaron
 * @param durationMs  duración total de la ventana de medición
 */
export function detectContractions(
  rawSamples: number[],
  durationMs: number
): DetectionResult {
  const n = rawSamples.length;

  if (n < 2 || durationMs <= 0) {
    return {
      contractions: [],
      baseline: 0,
      restingTone: 0,
      incompleteRelaxationPct: null,
      peakLevel: 0,
      threshold: 0,
      closeThreshold: 0,
      peakMax: 0,
      usable: false,
      reason: "muestras_insuficientes",
      meanStepMv: 0,
    };
  }

  const sorted = [...rawSamples].sort((a, b) => a - b);
  const baseline = percentile(sorted, PERCENTIL_REPOSO);
  const peakLevel = percentile(sorted, PERCENTIL_PICO);
  const peakMax = sorted[sorted.length - 1];
  const amplitude = peakLevel - baseline;

  const threshold = baseline + FRACCION_UMBRAL_APERTURA * amplitude;
  const closeThreshold = baseline + FRACCION_UMBRAL_CIERRE * amplitude;

  let sumStep = 0;
  for (let i = 1; i < n; i++) sumStep += Math.abs(rawSamples[i] - rawSamples[i - 1]);
  const meanStepMv = sumStep / (n - 1);

  const rechazo = (reason: DetectionResult["reason"]): DetectionResult => ({
    contractions: [],
    baseline,
    restingTone: baseline,
    incompleteRelaxationPct: null,
    peakLevel,
    threshold,
    closeThreshold,
    peakMax,
    usable: false,
    reason,
    meanStepMv,
  });

  if (amplitude < AMPLITUD_MINIMA_MV) return rechazo("sin_contraste");
  if (meanStepMv > MAX_SALTO_FRACCION * amplitude) return rechazo("senal_sin_envolvente");

  // Intervalo real entre muestras. No se asume 14 ms: la tasa de reporte del
  // firmware puede cambiar, y algunas mediciones viejas tienen otra.
  const sampleMs = durationMs / n;
  const muestrasBajoCierre = Math.max(1, Math.round(MS_MINIMO_BAJO_CIERRE / sampleMs));

  const contractions: DetectedContraction[] = [];

  let dentro = false;
  let idxInicio = 0;
  let pico = 0;
  // Cuántas muestras seguidas lleva por debajo del umbral de cierre, y dónde
  // empezó esa bajada: la contracción termina donde BAJÓ, no donde se confirmó.
  let bajoCierre = 0;
  let idxBajada = 0;

  const cerrar = (idxFin: number, truncated = false) => {
    const durationMsContraccion = (idxFin - idxInicio + 1) * sampleMs;
    // Una contracción truncada no tiene que cumplir la duración mínima: lo poco que
    // se alcanzó a grabar de ella no dice nada sobre cuánto duró en realidad.
    if (truncated || durationMsContraccion >= DURACION_MINIMA_MS) {
      contractions.push({
        amplitude: pico,
        durationMs: durationMsContraccion,
        startMs: idxInicio * sampleMs,
        truncated,
      });
    }
    dentro = false;
    bajoCierre = 0;
    pico = 0;
  };

  for (let i = 0; i < n; i++) {
    const v = rawSamples[i];

    if (!dentro) {
      if (v > threshold) {
        dentro = true;
        idxInicio = i;
        pico = v;
        bajoCierre = 0;
      }
      continue;
    }

    if (v > pico) pico = v;

    if (v < closeThreshold) {
      if (bajoCierre === 0) idxBajada = i;
      bajoCierre++;
      if (bajoCierre >= muestrasBajoCierre) {
        cerrar(idxBajada - 1);
      }
    } else {
      // Volvió a subir antes de confirmar el cierre: era ripple, se descarta.
      bajoCierre = 0;
    }
  }

  // La medición terminó con una contracción todavía abierta: se cierra en la última
  // muestra, marcada como truncada para que no ensucie las estadísticas.
  if (dentro) {
    cerrar(n - 1, true);
  }

  // La grabación arrancó con la señal ya por encima del umbral: esa contracción
  // empezó antes de que existiera el registro, así que tampoco se puede medir.
  // En la práctica casi no pasa (la medición arranca con el músculo en reposo,
  // después de la calibración), pero si pasa el sesgo va en el mismo sentido.
  if (contractions.length > 0 && rawSamples[0] > threshold) {
    contractions[0].truncated = true;
  }

  // --- TONO de reposo: promedio entre contracciones, con los flancos afuera ---
  // Cada contracción se extiende hacia atrás y hacia adelante mientras la señal siga
  // por encima del umbral de pie. Lo que queda después de sacar esos tramos es el
  // músculo realmente abajo, y su promedio es el tono.
  const footThreshold = baseline + FRACCION_PIE * amplitude;
  const esContraccion = new Array<boolean>(n).fill(false);

  for (const c of contractions) {
    let i = Math.max(0, Math.min(n - 1, Math.round(c.startMs / sampleMs)));
    let j = Math.max(0, Math.min(n - 1, Math.round((c.startMs + c.durationMs) / sampleMs)));
    while (i > 0 && rawSamples[i - 1] > footThreshold) i--;
    while (j < n - 1 && rawSamples[j + 1] > footThreshold) j++;
    for (let k = i; k <= j; k++) esContraccion[k] = true;
  }

  const muestrasTono = rawSamples.filter((_, i) => !esContraccion[i]);
  // Si no quedó nada abajo (contracciones encadenadas sin reposo real en el medio),
  // no hay tono que medir: se cae al piso y la métrica queda en null en vez de
  // inventar un número sobre cero muestras.
  const restingTone = muestrasTono.length
    ? muestrasTono.reduce((s, v) => s + v, 0) / muestrasTono.length
    : baseline;
  const incompleteRelaxationPct =
    muestrasTono.length && amplitude > 0
      ? ((restingTone - baseline) / amplitude) * 100
      : null;

  return {
    contractions,
    baseline,
    restingTone,
    incompleteRelaxationPct,
    peakLevel,
    threshold,
    closeThreshold,
    peakMax,
    usable: true,
    reason: null,
    meanStepMv,
  };
}
