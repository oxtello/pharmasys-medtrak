-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "locationId" TEXT,
    "locationName" TEXT,
    "medicationId" TEXT,
    "medicationName" TEXT,
    "inventoryTransactionId" TEXT,
    "reconciliationReportId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_occurredAt_idx" ON "AuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_category_occurredAt_idx" ON "AuditEvent"("category", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_occurredAt_idx" ON "AuditEvent"("action", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_occurredAt_idx" ON "AuditEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_locationId_occurredAt_idx" ON "AuditEvent"("locationId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_medicationId_occurredAt_idx" ON "AuditEvent"("medicationId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_reconciliationReportId_idx" ON "AuditEvent"("reconciliationReportId");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "MedicationMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_reconciliationReportId_fkey" FOREIGN KEY ("reconciliationReportId") REFERENCES "ReconciliationReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
