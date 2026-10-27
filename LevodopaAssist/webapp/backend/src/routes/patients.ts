import { Router } from "express";
import { prisma } from "../db/client";

export const patientsRouter = Router();

patientsRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const patients = await prisma.patient.findMany({
    where: q
      ? {
          OR: [
            { fullName: { contains: q } },
            { nationalId: { contains: q } },
            { diagnosis: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { fullName: "asc" },
  });

  res.json(patients);
});

patientsRouter.post("/", async (req, res) => {
  const { fullName, age, nationalId, diagnosis, notes, extraFields } = req.body ?? {};

  if (typeof fullName !== "string" || !fullName.trim()) {
    return res.status(400).json({ error: "fullName es obligatorio" });
  }
  if (typeof age !== "number" || !Number.isFinite(age) || age < 0) {
    return res.status(400).json({ error: "age debe ser un número válido" });
  }

  try {
    const patient = await prisma.patient.create({
      data: {
        fullName: fullName.trim(),
        age,
        nationalId: nationalId?.trim() || null,
        diagnosis: diagnosis?.trim() || null,
        notes: notes?.trim() || null,
        extraFields: extraFields ? JSON.stringify(extraFields) : null,
      },
    });
    res.status(201).json(patient);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Ya existe un paciente con ese DNI" });
    }
    throw err;
  }
});

patientsRouter.get("/:id", async (req, res) => {
  const patient = await prisma.patient.findUnique({ where: { id: req.params.id } });
  if (!patient) {
    return res.status(404).json({ error: "Paciente no encontrado" });
  }
  res.json(patient);
});

patientsRouter.patch("/:id", async (req, res) => {
  const { fullName, age, nationalId, diagnosis, notes, extraFields } = req.body ?? {};

  try {
    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data: {
        ...(fullName !== undefined && { fullName: String(fullName).trim() }),
        ...(age !== undefined && { age: Number(age) }),
        ...(nationalId !== undefined && { nationalId: nationalId?.trim() || null }),
        ...(diagnosis !== undefined && { diagnosis: diagnosis?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(extraFields !== undefined && {
          extraFields: extraFields ? JSON.stringify(extraFields) : null,
        }),
      },
    });
    res.json(patient);
  } catch (err: any) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Paciente no encontrado" });
    }
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Ya existe un paciente con ese DNI" });
    }
    throw err;
  }
});
