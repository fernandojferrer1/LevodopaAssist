import { Router } from "express";
import { asyncHandler } from "../asyncHandler";
import { getPatient } from "../db/patients";
import {
  createMeasurement,
  deleteMeasurement,
  getMeasurementById,
  listMeasurementsForPatient,
  PatientMissingError,
} from "../db/measurements";
import { computeDerivedMetrics } from "../services/derivedMetrics";
import { detectContractions, type DetectedContraction } from "../services/contractionDetection";

/**
 * Rehace el resumen de la medición a partir de las contracciones detectadas en el backend.
 */
function resumirDeteccion(
  contractions: DetectedContraction[],
  baseline: number,
  threshold: number,
  timerMedicionMs: number
) {
  const medibles = contractions.filter((c) => !c.truncated);
  const amplitudes = medibles.map((c) => c.amplitude);
  const duraciones = medibles.map((c) => c.durationMs);
  const prom = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

  const huecos: number[] = [];
  for (let i = 1; i < contractions.length; i++) {
    const finAnterior = contractions[i - 1].startMs + contractions[i - 1].durationMs;
    huecos.push(contractions[i].startMs - finAnterior);
  }

  return {
    conNum: contractions.length,
    peakMax: amplitudes.length ? Math.max(...amplitudes) : 0,
    promedioPeaks: prom(amplitudes),
    promedioLthMs: prom(duraciones),
    promedioBtwMs: prom(huecos),
    conXMinuto: timerMedicionMs > 0 ? (60000 * contractions.length) / timerMedicionMs : 0,
    yyn: baseline,
    thresh: threshold,
  };
}

const MEDICATION_STATES = ["sin_levodopa", "post_levodopa"] as const;

const NUMERIC_FIELDS = [
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

export const measurementsForPatientRouter = Router({ mergeParams: true });

measurementsForPatientRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { patientId } = req.params as { patientId: string };
    const measurements = await listMeasurementsForPatient(patientId);
    res.json(measurements);
  })
);

measurementsForPatientRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { patientId } = req.params as { patientId: string };
    const body = req.body ?? {};

    const patient = await getPatient(patientId);
    if (!patient) {
      return res.status(404).json({ error: "Paciente no encontrado" });
    }

    if (!MEDICATION_STATES.includes(body.medicationState)) {
      return res.status(400).json({
        error: `medicationState debe ser uno de: ${MEDICATION_STATES.join(", ")}`,
      });
    }
    if (!body.measuredAt || Number.isNaN(Date.parse(body.measuredAt))) {
      return res.status(400).json({ error: "measuredAt debe ser una fecha válida" });
    }
    for (const field of NUMERIC_FIELDS) {
      if (typeof body[field] !== "number" || !Number.isFinite(body[field])) {
        return res.status(400).json({ error: `${field} debe ser un número válido` });
      }
    }
    const contractions = Array.isArray(body.contractions) ? body.contractions : [];
    for (const c of contractions) {
      if (
        typeof c.amplitude !== "number" ||
        typeof c.durationMs !== "number" ||
        !Number.isFinite(c.amplitude) ||
        !Number.isFinite(c.durationMs)
      ) {
        return res.status(400).json({ error: "Cada contracción necesita amplitude y durationMs numéricos" });
      }
    }

    const rawSamples: number[] | null = Array.isArray(body.rawSamples) ? body.rawSamples : null;

    const deteccion = rawSamples ? detectContractions(rawSamples, body.timerMedicionMs) : null;
    const usarBackend = deteccion?.usable === true;

    const contraccionesFinales = usarBackend ? deteccion!.contractions : contractions;
    const resumen = usarBackend
      ? resumirDeteccion(
          deteccion!.contractions,
          deteccion!.baseline,
          deteccion!.threshold,
          body.timerMedicionMs
        )
      : {
          conNum: body.conNum,
          peakMax: body.peakMax,
          promedioPeaks: body.promedioPeaks,
          promedioLthMs: body.promedioLthMs,
          promedioBtwMs: body.promedioBtwMs,
          conXMinuto: body.conXMinuto,
          yyn: body.yyn,
          thresh: body.thresh,
        };

    const derived = computeDerivedMetrics(
      contraccionesFinales,
      rawSamples,
      resumen.yyn,
      resumen.peakMax,
      body.timerMedicionMs
    );

    try {
      const measurement = await createMeasurement(patientId, {
        medicationState: body.medicationState,
        measuredAt: new Date(body.measuredAt).toISOString(),
        location: body.location?.trim() || null,
        notes: body.notes?.trim() || null,
        status: body.status === "aborted" ? "aborted" : "completed",
        conNum: resumen.conNum,
        timerMedicionMs: body.timerMedicionMs,
        conXMinuto: resumen.conXMinuto,
        peakMax: resumen.peakMax,
        promedioPeaks: resumen.promedioPeaks,
        yyn: resumen.yyn,
        promedioLthMs: resumen.promedioLthMs,
        promedioBtwMs: resumen.promedioBtwMs,
        thresh: resumen.thresh,
        amplitudeDecrementPct: derived.amplitudeDecrementPct,
        durationDecrementPct: derived.durationDecrementPct,
        durationCvPct: derived.durationCvPct,
        peakToBaseRatio: derived.peakToBaseRatio,
        iemg: derived.iemg,
        detectionSource: usarBackend ? "backend" : "firmware",
        detectionNote: usarBackend ? null : (deteccion?.reason ?? "sin_senal_cruda"),
        restingToneMv: usarBackend ? deteccion!.restingTone : null,
        incompleteRelaxationPct: usarBackend ? deteccion!.incompleteRelaxationPct : null,
        rawSamplesJson: rawSamples ? JSON.stringify(rawSamples) : null,
        contractions: contraccionesFinales.map(
          (c: { amplitude: number; durationMs: number; truncated?: boolean }) => ({
            amplitude: c.amplitude,
            durationMs: c.durationMs,
            truncated: c.truncated ?? false,
          })
        ),
      });

      res.status(201).json(measurement);
    } catch (err) {
      if (err instanceof PatientMissingError) {
        return res.status(404).json({ error: "Paciente no encontrado" });
      }
      throw err;
    }
  })
);

export const measurementByIdRouter = Router();

measurementByIdRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const measurement = await getMeasurementById(String(req.params.id));
    if (!measurement) {
      return res.status(404).json({ error: "Medición no encontrada" });
    }
    res.json(measurement);
  })
);

measurementByIdRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const deleted = await deleteMeasurement(id);
    if (!deleted) {
      return res.status(404).json({ error: "Medición no encontrada" });
    }
    res.json({ ok: true });
  })
);
