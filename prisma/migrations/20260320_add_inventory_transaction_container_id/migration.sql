ALTER TABLE "InventoryTransaction"
ADD COLUMN IF NOT EXISTS "containerId" TEXT;

CREATE INDEX IF NOT EXISTS "InventoryTransaction_containerId_occurredAt_idx"
ON "InventoryTransaction" ("containerId", "occurredAt");
