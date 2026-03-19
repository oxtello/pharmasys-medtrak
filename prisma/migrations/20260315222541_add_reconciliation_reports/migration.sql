-- CreateTable
CREATE TABLE "ReconciliationReport" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reviewTiming" TEXT NOT NULL,
    "reviewerRole" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "search" TEXT,
    "deaSchedules" TEXT,
    "discrepancyOnly" BOOLEAN NOT NULL DEFAULT false,
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationReportRow" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "strength" TEXT,
    "dosageForm" TEXT,
    "deaSchedule" TEXT,
    "locationId" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "beginningBalance" DECIMAL(12,3) NOT NULL,
    "receipts" DECIMAL(12,3) NOT NULL,
    "transfersIn" DECIMAL(12,3) NOT NULL,
    "dispensed" DECIMAL(12,3) NOT NULL,
    "waste" DECIMAL(12,3) NOT NULL,
    "dispose" DECIMAL(12,3) NOT NULL,
    "transfersOut" DECIMAL(12,3) NOT NULL,
    "adjustments" DECIMAL(12,3) NOT NULL,
    "expectedEndingBalance" DECIMAL(12,3) NOT NULL,
    "physicalCount" DECIMAL(12,3),
    "variance" DECIMAL(12,3),
    "notes" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationReportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationReport_locationId_startDate_endDate_idx" ON "ReconciliationReport"("locationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "ReconciliationReport_finalized_finalizedAt_idx" ON "ReconciliationReport"("finalized", "finalizedAt");

-- CreateIndex
CREATE INDEX "ReconciliationReportRow_reportId_idx" ON "ReconciliationReportRow"("reportId");

-- CreateIndex
CREATE INDEX "ReconciliationReportRow_locationId_medicationId_idx" ON "ReconciliationReportRow"("locationId", "medicationId");

-- AddForeignKey
ALTER TABLE "ReconciliationReport" ADD CONSTRAINT "ReconciliationReport_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationReportRow" ADD CONSTRAINT "ReconciliationReportRow_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ReconciliationReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
