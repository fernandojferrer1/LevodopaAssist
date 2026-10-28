export const SUMMARY_FIELD_ORDER = [
  "conNum",
  "timerMedicionMs",
  "conXMinuto",
  "peakMax",
  "promedioPeaks",
  "yyn",
  "promedioLthMs",
  "promedioBtwMs",
  "thresh",
] as const;

export type SummaryFields = Record<(typeof SUMMARY_FIELD_ORDER)[number], number>;

export type ParsedLine =
  | { type: "EMPTY" }
  | { type: "RAW_SAMPLE"; value: number }
  | { type: "CONTRACTION_DETAIL"; amplitude: number; durationMs: number }
  | { type: "SUMMARY"; fields: SummaryFields }
  | { type: "UNKNOWN"; raw: string };

const NUMBER_RE = /^-?\d+(\.\d+)?$/;

function isNumeric(s: string): boolean {
  return NUMBER_RE.test(s.trim());
}

/**
 * Clasifica una línea de texto recibida por Serial del firmware EMG_v3D.
 * El firmware no tiene protocolo formal (sin JSON, sin checksum, sin
 * delimitadores de inicio/fin), así que se clasifica heurísticamente por
 * forma de la línea. El orden de los chequeos importa: SUMMARY y
 * CONTRACTION_DETAIL empiezan ambos con una coma, así que se distinguen
 * por cantidad exacta de campos, nunca solo por el prefijo.
 */
export function classifyLine(rawLine: string): ParsedLine {
  const line = rawLine.trim();

  if (line === "") {
    return { type: "EMPTY" };
  }

  if (line.includes(",")) {
    const fields = line.split(",");

    // Resumen final: ",,,con_num,timermedicion,con_xminuto,peak_max,promedio_peaks,yyn,promedio_lth,promedio_btw,thresh"
    if (
      fields.length === 12 &&
      fields[0] === "" &&
      fields[1] === "" &&
      fields[2] === "" &&
      fields.slice(3).every(isNumeric)
    ) {
      const values = fields.slice(3).map(Number);
      const fieldsObj = Object.fromEntries(
        SUMMARY_FIELD_ORDER.map((key, i) => [key, values[i]])
      ) as SummaryFields;
      return { type: "SUMMARY", fields: fieldsObj };
    }

    // Detalle de contracción: ",amplitud,duracion"
    if (fields.length === 3 && fields[0] === "" && isNumeric(fields[1]) && isNumeric(fields[2])) {
      return {
        type: "CONTRACTION_DETAIL",
        amplitude: Number(fields[1]),
        durationMs: Number(fields[2]),
      };
    }

    return { type: "UNKNOWN", raw: rawLine };
  }

  if (isNumeric(line)) {
    return { type: "RAW_SAMPLE", value: Number(line) };
  }

  return { type: "UNKNOWN", raw: rawLine };
}
