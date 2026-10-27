import express from "express";
import cors from "cors";
import { patientsRouter } from "./routes/patients";
import { measurementsForPatientRouter, measurementByIdRouter } from "./routes/measurements";
import { comparisonsForPatientRouter, comparisonByIdRouter } from "./routes/comparisons";

const app = express();
const port = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/patients/:patientId/measurements", measurementsForPatientRouter);
app.use("/api/patients/:patientId/comparisons", comparisonsForPatientRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/measurements", measurementByIdRouter);
app.use("/api/comparisons", comparisonByIdRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

// Express 5 pasa al callback el error de listen (p. ej. puerto ocupado) en vez de tirarlo:
// sin este chequeo el backend anunciaba que escuchaba y el frontend recibía 502.
app.listen(port, (err?: Error) => {
  if (err) {
    console.error(`No se pudo abrir el puerto ${port}: ${err.message}`);
    if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
      console.error(`Otro programa ya usa el puerto ${port}. Cerralo o ejecuta diagnostico.cmd para ver cuál es.`);
    }
    process.exit(1);
  }
  console.log(`Backend escuchando en http://localhost:${port}`);
});
