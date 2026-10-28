import { Router } from "express";
import { asyncHandler } from "../asyncHandler";
import {
  createComparison,
  getComparisonById,
  getMeasurementRowForCompare,
  listComparisonsForPatient,
} from "../db/comparisons";
import { computeComparisonMetrics } from "../services/comparison";

export const comparisonsForPatientRouter = Router({ mergeParams: true });

comparisonsForPatientRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { patientId } = req.params as { patientId: string };
    const comparisons = await listComparisonsForPatient(patientId);
    // Contrato histórico: metrics parseado; metricsJson también viaja en el objeto.
    res.json(comparisons);
  })
);

comparisonsForPatientRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { patientId } = req.params as { patientId: string };
    const { measurementAId, measurementBId } = req.body ?? {};

    if (!measurementAId || !measurementBId) {
      return res.status(400).json({ error: "measurementAId y measurementBId son obligatorios" });
    }
    if (measurementAId === measurementBId) {
      return res.status(400).json({ error: "Elegí dos mediciones distintas para comparar" });
    }

    const [measurementA, measurementB] = await Promise.all([
      getMeasurementRowForCompare(measurementAId),
      getMeasurementRowForCompare(measurementBId),
    ]);

    if (!measurementA || !measurementB) {
      return res.status(404).json({ error: "Alguna de las mediciones no existe" });
    }
    if (measurementA.patientId !== patientId || measurementB.patientId !== patientId) {
      return res.status(400).json({ error: "Ambas mediciones deben pertenecer al paciente" });
    }

    const metrics = computeComparisonMetrics(measurementA, measurementB);
    const comparison = await createComparison({
      patientId,
      measurementAId,
      measurementBId,
      metrics,
    });

    res.status(201).json(comparison);
  })
);

export const comparisonByIdRouter = Router();

comparisonByIdRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const comparison = await getComparisonById(String(req.params.id));
    if (!comparison) {
      return res.status(404).json({ error: "Comparación no encontrada" });
    }
    res.json(comparison);
  })
);
