-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Measurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "medicationState" TEXT NOT NULL,
    "measuredAt" DATETIME NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "conNum" INTEGER NOT NULL,
    "timerMedicionMs" REAL NOT NULL,
    "conXMinuto" REAL NOT NULL,
    "peakMax" REAL NOT NULL,
    "promedioPeaks" REAL NOT NULL,
    "yyn" REAL NOT NULL,
    "promedioLthMs" REAL NOT NULL,
    "promedioBtwMs" REAL NOT NULL,
    "thresh" REAL NOT NULL,
    "amplitudeDecrementPct" REAL,
    "durationDecrementPct" REAL,
    "durationCvPct" REAL,
    "peakToBaseRatio" REAL,
    "iemg" REAL,
    "detectionSource" TEXT NOT NULL DEFAULT 'firmware',
    "detectionNote" TEXT,
    "rawSamplesJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Measurement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Measurement" ("amplitudeDecrementPct", "conNum", "conXMinuto", "createdAt", "durationCvPct", "durationDecrementPct", "id", "iemg", "location", "measuredAt", "medicationState", "notes", "patientId", "peakMax", "peakToBaseRatio", "promedioBtwMs", "promedioLthMs", "promedioPeaks", "rawSamplesJson", "sequenceNumber", "status", "thresh", "timerMedicionMs", "yyn") SELECT "amplitudeDecrementPct", "conNum", "conXMinuto", "createdAt", "durationCvPct", "durationDecrementPct", "id", "iemg", "location", "measuredAt", "medicationState", "notes", "patientId", "peakMax", "peakToBaseRatio", "promedioBtwMs", "promedioLthMs", "promedioPeaks", "rawSamplesJson", "sequenceNumber", "status", "thresh", "timerMedicionMs", "yyn" FROM "Measurement";
DROP TABLE "Measurement";
ALTER TABLE "new_Measurement" RENAME TO "Measurement";
CREATE INDEX "Measurement_patientId_measuredAt_idx" ON "Measurement"("patientId", "measuredAt");
CREATE UNIQUE INDEX "Measurement_patientId_sequenceNumber_key" ON "Measurement"("patientId", "sequenceNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
