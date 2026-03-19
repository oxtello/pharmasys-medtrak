import crypto from "crypto";
import type { InventoryTransaction, Prisma } from "@/generated/prisma/client";

type LedgerHashInput = {
  id: string;
  type: string;
  locationId: string;
  medicationId: string;
  actorUserId: string;
  witnessUserId?: string | null;
  quantity: Prisma.Decimal | string | number;
  inventoryUnit: string;
  lotNumber?: string | null;
  expirationDate?: Date | string | null;
  barcode?: string | null;
  note?: string | null;
  referenceId?: string | null;
  occurredAt: Date | string;
  previousHash?: string | null;
  chainVersion?: number | null;
};

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function buildInventoryTransactionHash(input: LedgerHashInput): string {
  const payload = [
    normalizeValue(input.id),
    normalizeValue(input.type),
    normalizeValue(input.locationId),
    normalizeValue(input.medicationId),
    normalizeValue(input.actorUserId),
    normalizeValue(input.witnessUserId),
    normalizeValue(input.quantity),
    normalizeValue(input.inventoryUnit),
    normalizeValue(input.lotNumber),
    normalizeValue(input.expirationDate),
    normalizeValue(input.barcode),
    normalizeValue(input.note),
    normalizeValue(input.referenceId),
    normalizeValue(input.occurredAt),
    normalizeValue(input.previousHash),
    normalizeValue(input.chainVersion ?? 1),
  ].join("|");

  return crypto.createHash("sha256").update(payload).digest("hex");
}

export async function getPreviousInventoryTransactionHash(
  prismaLike: {
    inventoryTransaction: {
      findFirst: (args: unknown) => Promise<Pick<InventoryTransaction, "hash"> | null>;
    };
  }
): Promise<string | null> {
  const previous = await prismaLike.inventoryTransaction.findFirst({
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      hash: true,
    },
  });

  return previous?.hash ?? null;
}
