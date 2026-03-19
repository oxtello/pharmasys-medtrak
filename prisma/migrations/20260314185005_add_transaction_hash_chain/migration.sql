/*
  Warnings:

  - A unique constraint covering the columns `[hash]` on the table `InventoryTransaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "chainVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "hash" TEXT,
ADD COLUMN     "previousHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_hash_key" ON "InventoryTransaction"("hash");

-- CreateIndex
CREATE INDEX "InventoryTransaction_occurredAt_idx" ON "InventoryTransaction"("occurredAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_previousHash_idx" ON "InventoryTransaction"("previousHash");
