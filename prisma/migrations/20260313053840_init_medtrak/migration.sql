-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PHARMACIST', 'TECHNICIAN', 'NURSE', 'AUDITOR');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('RECEIVE', 'DISPENSE', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUST', 'WASTE', 'DISPOSE', 'CYCLE_COUNT');

-- CreateEnum
CREATE TYPE "InventoryUnit" AS ENUM ('EACH', 'ML', 'TABLET', 'CAPSULE', 'VIAL', 'AMPULE', 'TUBE', 'BOTTLE', 'PATCH', 'SYRINGE', 'KIT', 'GRAM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL,
    "homeLocationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "strength" TEXT,
    "dosageForm" TEXT,
    "manufacturer" TEXT,
    "ndc" TEXT,
    "barcode" TEXT NOT NULL,
    "deaSchedule" TEXT,
    "inventoryUnit" "InventoryUnit" NOT NULL DEFAULT 'EACH',
    "isControlled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMultiDose" BOOLEAN NOT NULL DEFAULT false,
    "openedUsePolicy" TEXT,
    "openedUseDays" INTEGER,
    "requiresOpenedDate" BOOLEAN NOT NULL DEFAULT false,
    "requiresWitnessWaste" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "lotNumber" TEXT,
    "expirationDate" TIMESTAMP(3),
    "quantityOnHand" DECIMAL(12,3) NOT NULL,
    "openedQuantity" DECIMAL(12,3),
    "openedDate" TIMESTAMP(3),
    "discardAfterDate" TIMESTAMP(3),
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "locationId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "witnessUserId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "inventoryUnit" "InventoryUnit" NOT NULL DEFAULT 'EACH',
    "lotNumber" TEXT,
    "expirationDate" TIMESTAMP(3),
    "barcode" TEXT,
    "note" TEXT,
    "referenceId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MedicationMaster_barcode_key" ON "MedicationMaster"("barcode");

-- CreateIndex
CREATE INDEX "InventoryItem_locationId_medicationId_idx" ON "InventoryItem"("locationId", "medicationId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_locationId_medicationId_occurredAt_idx" ON "InventoryTransaction"("locationId", "medicationId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_actorUserId_occurredAt_idx" ON "InventoryTransaction"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "MedicationMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "MedicationMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
