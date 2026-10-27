import { Router } from "express";
import { asyncHandler } from "../asyncHandler";
import {
  createPatient,
  getPatient,
  listPatients,
  NotFoundError,
  UniqueViolationError,
  updatePatient,
} from "../db/patients";

export const patientsRouter = Router();

patientsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const patients = await listPatients(q || undefined);
    res.json(patients);
  })
);

patientsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { fullName, age, nationalId, diagnosis, notes, extraFields } = req.body ?? {};

    if (typeof fullName !== "string" || !fullName.trim()) {
      return res.status(400).json({ error: "fullName es obligatorio" });
    }
    if (typeof age !== "number" || !Number.isFinite(age) || age < 0) {
      return res.status(400).json({ error: "age debe ser un número válido" });
    }

    try {
      const patient = await createPatient({
        fullName: fullName.trim(),
        age,
        nationalId: nationalId?.trim() || null,
        diagnosis: diagnosis?.trim() || null,
        notes: notes?.trim() || null,
        extraFields: extraFields ? JSON.stringify(extraFields) : null,
      });
      res.status(201).json(patient);
    } catch (err) {
      if (err instanceof UniqueViolationError) {
        return res.status(409).json({ error: err.message });
      }
      throw err;
    }
  })
);

patientsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const patient = await getPatient(id);
    if (!patient) {
      return res.status(404).json({ error: "Paciente no encontrado" });
    }
    res.json(patient);
  })
);

patientsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { fullName, age, nationalId, diagnosis, notes, extraFields } = req.body ?? {};

    try {
      const patient = await updatePatient(id, {
        ...(fullName !== undefined && { fullName: String(fullName).trim() }),
        ...(age !== undefined && { age: Number(age) }),
        ...(nationalId !== undefined && { nationalId: nationalId?.trim() || null }),
        ...(diagnosis !== undefined && { diagnosis: diagnosis?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(extraFields !== undefined && {
          extraFields: extraFields ? JSON.stringify(extraFields) : null,
        }),
      });
      res.json(patient);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      if (err instanceof UniqueViolationError) {
        return res.status(409).json({ error: err.message });
      }
      throw err;
    }
  })
);
