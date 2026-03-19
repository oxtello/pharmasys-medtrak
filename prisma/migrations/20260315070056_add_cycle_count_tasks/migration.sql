-- CreateTable
CREATE TABLE "CycleCountTask" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "riskScore" INTEGER NOT NULL,
    "priority" TEXT NOT NULL,
    "reasonCodes" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CycleCountTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CycleCountTask_scheduledFor_idx" ON "CycleCountTask"("scheduledFor");

-- CreateIndex
CREATE INDEX "CycleCountTask_status_idx" ON "CycleCountTask"("status");

-- CreateIndex
CREATE INDEX "CycleCountTask_medicationId_locationId_idx" ON "CycleCountTask"("medicationId", "locationId");

-- AddForeignKey
ALTER TABLE "CycleCountTask" ADD CONSTRAINT "CycleCountTask_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "MedicationMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountTask" ADD CONSTRAINT "CycleCountTask_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountTask" ADD CONSTRAINT "CycleCountTask_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
