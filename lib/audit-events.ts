import { prisma } from "@/lib/prisma";

type LogAuditEventInput = {
  occurredAt?: Date;
  category: string;
  action: string;
  actorUserId?: string | null;
  actorName?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  medicationId?: string | null;
  medicationName?: string | null;
  inventoryTransactionId?: string | null;
  reconciliationReportId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logAuditEvent(input: LogAuditEventInput) {
  try {
    await prisma.auditEvent.create({
      data: {
        occurredAt: input.occurredAt ?? new Date(),
        category: input.category,
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        actorName: input.actorName ?? null,
        locationId: input.locationId ?? null,
        locationName: input.locationName ?? null,
        medicationId: input.medicationId ?? null,
        medicationName: input.medicationName ?? null,
        inventoryTransactionId: input.inventoryTransactionId ?? null,
        reconciliationReportId: input.reconciliationReportId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        details: input.details ?? null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (error) {
    console.error("Failed to write audit event", error);
  }
}

export function buildInventoryAuditDetails(input: {
  transactionType: string;
  quantity?: number | string | null;
  inventoryUnit?: string | null;
  deaSchedule?: string | null;
  barcode?: string | null;
  witnessName?: string | null;
  note?: string | null;
}) {
  return [
    input.transactionType,
    input.quantity !== null && input.quantity !== undefined
      ? `${input.quantity}${input.inventoryUnit ? ` ${input.inventoryUnit}` : ""}`
      : "",
    input.deaSchedule ? `DEA ${input.deaSchedule}` : "",
    input.barcode ? `Barcode ${input.barcode}` : "",
    input.witnessName ? `Witness ${input.witnessName}` : "",
    input.note ? `Notes: ${input.note}` : "",
  ]
    .filter(Boolean)
    .join(" • ");
}
