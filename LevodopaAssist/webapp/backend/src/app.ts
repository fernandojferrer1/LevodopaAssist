import express from "express";
import { patientsRouter } from "./routes/patients";
import { measurementsForPatientRouter, measurementByIdRouter } from "./routes/measurements";
import { comparisonsForPatientRouter, comparisonByIdRouter } from "./routes/comparisons";
import { pingDatabase } from "./db/patients";
import { asyncHandler } from "./asyncHandler";

// Valida SUPABASE_* al cargar el módulo (en Vercel vienen de Project Settings → Environment Variables).
import "./db/supabase";

/**
 * App Express sin listen — local (`index.ts`) y Vercel Services (`framework: express`).
 *
 * Rutas bajo /api/...: el frontend usa fetch('/api...') y el rewrite de Vercel
 * entrega al service backend el path original (/api/...).
 */
const app = express();

// Same-origin en prod (mismo dominio) y en local (proxy Vite /api → :4000): no hace falta cors().
app.use(express.json({ limit: "2mb" }));

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    const ok = await pingDatabase();
    if (!ok) {
      return res.status(503).json({ status: "error" });
    }
    res.json({ status: "ok" });
  })
);

app.use("/api/patients/:patientId/measurements", measurementsForPatientRouter);
app.use("/api/patients/:patientId/comparisons", comparisonsForPatientRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/measurements", measurementByIdRouter);
app.use("/api/comparisons", comparisonByIdRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

export default app;
