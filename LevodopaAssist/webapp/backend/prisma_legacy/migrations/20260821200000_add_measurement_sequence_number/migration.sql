-- AddColumn (temporary default to satisfy NOT NULL on existing rows; app always sets it explicitly on create)
ALTER TABLE "Measurement" ADD COLUMN "sequenceNumber" INTEGER NOT NULL DEFAULT 0;

-- Backfill: number each patient's existing measurements in the order they were performed
-- (measuredAt, tie-broken by createdAt), 1-based.
UPDATE "Measurement"
SET "sequenceNumber" = (
  SELECT COUNT(*)
  FROM "Measurement" m2
  WHERE m2."patientId" = "Measurement"."patientId"
    AND (
      m2."measuredAt" < "Measurement"."measuredAt"
      OR (m2."measuredAt" = "Measurement"."measuredAt" AND m2."createdAt" <= "Measurement"."createdAt")
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "Measurement_patientId_sequenceNumber_key" ON "Measurement"("patientId", "sequenceNumber");
