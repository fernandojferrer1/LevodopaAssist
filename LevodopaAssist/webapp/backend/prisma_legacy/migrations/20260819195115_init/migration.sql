-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "nationalId" TEXT,
    "diagnosis" TEXT,
    "notes" TEXT,
    "extraFields" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
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
    "rawSamplesJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Measurement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeasurementContraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "measurementId" TEXT NOT NULL,
    "sequenceIndex" INTEGER NOT NULL,
    "amplitude" REAL NOT NULL,
    "durationMs" REAL NOT NULL,
    CONSTRAINT "MeasurementContraction_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "Measurement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comparison" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "measurementAId" TEXT NOT NULL,
    "measurementBId" TEXT NOT NULL,
    "metricsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comparison_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comparison_measurementAId_fkey" FOREIGN KEY ("measurementAId") REFERENCES "Measurement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comparison_measurementBId_fkey" FOREIGN KEY ("measurementBId") REFERENCES "Measurement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Patient_nationalId_key" ON "Patient"("nationalId");

-- CreateIndex
CREATE INDEX "Measurement_patientId_measuredAt_idx" ON "Measurement"("patientId", "measuredAt");

-- CreateIndex
CREATE INDEX "MeasurementContraction_measurementId_sequenceIndex_idx" ON "MeasurementContraction"("measurementId", "sequenceIndex");

-- CreateIndex
CREATE INDEX "Comparison_patientId_idx" ON "Comparison"("patientId");
