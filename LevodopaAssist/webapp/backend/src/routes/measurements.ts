import { Router } from "express";
import { prisma } from "../db/client";
import { computeDerivedMetrics } from "../services/derivedMetrics";
import { detectContractions, type DetectedContraction } from "../services/contractionDetection";

/**
 * Rehace el resumen de la medición a partir de las contracciones detectadas en el backend.
 *
 * Hay que recalcularlo entero, no solo reemplazar la lista: el resumen que manda el firmware
 * (conNum, peakMax, promedios, thresh, yyn) sale de SU detección, con SU umbral. Si se guardara
 * la lista del backend junto al resumen del firmware, la medición quedaría diciendo dos cosas
 * distintas a la vez - por ejemplo Medición06, con 15 contracciones en la lista y conNum = 0.
 */
function resumirDeteccion(
  contractions: DetectedContraction[],
  baseline: number,
  threshold: number,
  timerMedicionMs: number
) {
  // Amplitud y duración salen solo de las contracciones que la ventana dejó medir
  // enteras. El conteo y la frecuencia, en cambio, salen de TODAS: una contracción
  // cortada por el final de la ventana igual ocurrió, así que cuenta para el total
  // y para las contracciones por minuto.
  const medibles = contractions.filter((c) => !c.truncated);
  const amplitudes = medibles.map((c) => c.amplitude);
  const duraciones = medibles.map((c) => c.durationMs);
  const prom = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

  // Tiempo entre el fin de una contracción y el inicio de la siguiente. Acá sí entran
  // todas: el hueco que precede a una contracción truncada es real, porque lo que la
  // ventana cortó es el final de esa contracción, no su comienzo.
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

// Mounted at /api/patients/:patientId/measurements
export const measurementsForPatientRouter = Router({ mergeParams: true });

measurementsForPatientRouter.get("/", async (req, res) => {
  const { patientId } = req.params as { patientId: string };

  const measurements = await prisma.measurement.findMany({
    where: { patientId },
    orderBy: { measuredAt: "desc" },
    select: {
      id: true,
      patientId: true,
      sequenceNumber: true,
      medicationState: true,
      measuredAt: true,
      location: true,
      notes: true,
      status: true,
      conNum: true,
      timerMedicionMs: true,
      conXMinuto: true,
      peakMax: true,
      promedioPeaks: true,
      yyn: true,
      promedioLthMs: true,
      promedioBtwMs: true,
      thresh: true,
      amplitudeDecrementPct: true,
      durationDecrementPct: true,
      durationCvPct: true,
      peakToBaseRatio: true,
      iemg: true,
      createdAt: true,
    },
  });

  res.json(measurements);
});

measurementsForPatientRouter.post("/", async (req, res) => {
  const { patientId } = req.params as { patientId: string };
  const body = req.body ?? {};

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
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

  const sequenceNumber = (await prisma.measurement.count({ where: { patientId } })) + 1;

  const rawSamples: number[] | null = Array.isArray(body.rawSamples) ? body.rawSamples : null;

  // --- Detección de contracciones sobre la señal grabada ---
  // El equipo ya detectó en vivo, pero con un umbral fijado antes de medir, a partir de 2s de
  // calibración. Acá está la medición entera, así que el umbral se calcula sobre los mismos
  // datos que se van a analizar y no depende de que la calibración haya salido bien. Cuando la
  // señal grabada no se puede analizar (ver `reason`), se conserva lo que mandó el firmware.
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

  const measurement = await prisma.measurement.create({
    data: {
      patientId,
      sequenceNumber,
      medicationState: body.medicationState,
      measuredAt: new Date(body.measuredAt),
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
      // Los dos niveles de reposo solo tienen sentido si la señal se pudo analizar. Cuando se
      // cae al resumen del firmware, ese manda un único valor mezclado y no hay forma de
      // separarlo, así que quedan en null en vez de guardar un número que no significa eso.
      restingToneMv: usarBackend ? deteccion!.restingTone : null,
      incompleteRelaxationPct: usarBackend ? deteccion!.incompleteRelaxationPct : null,
      rawSamplesJson: rawSamples ? JSON.stringify(rawSamples) : null,
      contractions: {
        create: contraccionesFinales.map(
          (c: { amplitude: number; durationMs: number; truncated?: boolean }, index: number) => ({
            sequenceIndex: index,
            amplitude: c.amplitude,
            durationMs: c.durationMs,
            truncated: c.truncated ?? false,
          })
        ),
      },
    },
    include: { contractions: true },
  });

  res.status(201).json(measurement);
});

// Mounted at /api/measurements
export const measurementByIdRouter = Router();

measurementByIdRouter.get("/:id", async (req, res) => {
  const measurement = await prisma.measurement.findUnique({
    where: { id: req.params.id },
    include: { contractions: { orderBy: { sequenceIndex: "asc" } } },
  });

  if (!measurement) {
    return res.status(404).json({ error: "Medición no encontrada" });
  }

  res.json(measurement);
});

measurementByIdRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.measurement.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "Medición no encontrada" });
  }

  await prisma.$transaction([
    prisma.comparison.deleteMany({ where: { OR: [{ measurementAId: id }, { measurementBId: id }] } }),
    prisma.measurementContraction.deleteMany({ where: { measurementId: id } }),
    prisma.measurement.delete({ where: { id } }),
  ]);

  res.json({ ok: true });
});
