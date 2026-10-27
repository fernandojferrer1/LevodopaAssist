import { Router } from "express";
import { prisma } from "../db/client";
import { computeComparisonMetrics } from "../services/comparison";

// Mounted at /api/patients/:patientId/comparisons
export const comparisonsForPatientRouter = Router({ mergeParams: true });

comparisonsForPatientRouter.get("/", async (req, res) => {
  const { patientId } = req.params as { patientId: string };

  const comparisons = await prisma.comparison.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    include: { measurementA: true, measurementB: true },
  });

  res.json(
    comparisons.map((c) => ({ ...c, metrics: JSON.parse(c.metricsJson) }))
  );
});

comparisonsForPatientRouter.post("/", async (req, res) => {
  const { patientId } = req.params as { patientId: string };
  const { measurementAId, measurementBId } = req.body ?? {};

  if (!measurementAId || !measurementBId) {
    return res.status(400).json({ error: "measurementAId y measurementBId son obligatorios" });
  }
  if (measurementAId === measurementBId) {
    return res.status(400).json({ error: "Elegí dos mediciones distintas para comparar" });
  }

  const [measurementA, measurementB] = await Promise.all([
    prisma.measurement.findUnique({ where: { id: measurementAId } }),
    prisma.measurement.findUnique({ where: { id: measurementBId } }),
  ]);

  if (!measurementA || !measurementB) {
    return res.status(404).json({ error: "Alguna de las mediciones no existe" });
  }
  if (measurementA.patientId !== patientId || measurementB.patientId !== patientId) {
    return res.status(400).json({ error: "Ambas mediciones deben pertenecer al paciente" });
  }

  const metrics = computeComparisonMetrics(measurementA, measurementB);

  const comparison = await prisma.comparison.create({
    data: {
      patientId,
      measurementAId,
      measurementBId,
      metricsJson: JSON.stringify(metrics),
    },
    include: { measurementA: true, measurementB: true },
  });

  res.status(201).json({ ...comparison, metrics });
});

// Mounted at /api/comparisons
export const comparisonByIdRouter = Router();

comparisonByIdRouter.get("/:id", async (req, res) => {
  const comparison = await prisma.comparison.findUnique({
    where: { id: req.params.id },
    include: { measurementA: true, measurementB: true },
  });

  if (!comparison) {
    return res.status(404).json({ error: "Comparación no encontrada" });
  }

  res.json({ ...comparison, metrics: JSON.parse(comparison.metricsJson) });
});
