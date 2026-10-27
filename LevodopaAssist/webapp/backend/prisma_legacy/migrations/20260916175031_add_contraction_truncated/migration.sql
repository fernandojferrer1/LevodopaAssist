-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MeasurementContraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "measurementId" TEXT NOT NULL,
    "sequenceIndex" INTEGER NOT NULL,
    "amplitude" REAL NOT NULL,
    "durationMs" REAL NOT NULL,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MeasurementContraction_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "Measurement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MeasurementContraction" ("amplitude", "durationMs", "id", "measurementId", "sequenceIndex") SELECT "amplitude", "durationMs", "id", "measurementId", "sequenceIndex" FROM "MeasurementContraction";
DROP TABLE "MeasurementContraction";
ALTER TABLE "new_MeasurementContraction" RENAME TO "MeasurementContraction";
CREATE INDEX "MeasurementContraction_measurementId_sequenceIndex_idx" ON "MeasurementContraction"("measurementId", "sequenceIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
