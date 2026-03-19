import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type AlertSeverity = "LOW" | "MEDIUM" | "HIGH";

type AlertCategory =
  | "HIGH_WASTE"
  | "AFTER_HOURS_CONTROLLED"
  | "FREQUENT_ADJUSTMENTS"
  | "REPEATED_VARIANCE";

type DiversionAlert = {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  detail: string;
  medicationName?: string | null;
  deaSchedule?: string | null;
  locationName?: string | null;
  actorName?: string | null;
  eventCount: number;
  lastOccurredAt?: string | null;
};

type AuditEventMetadata = {
  transactionId?: string;
  transactionHash?: string;
  previousHash?: string | null;
  chainVersion?: number;
  transactionType?: string;
  barcode?: string;
  quantity?: number;
  signedQuantity?: number;
  adjustmentType?: "ADD" | "SUBTRACT";
  inventoryUnit?: string;
  reasonCode?: string;
  note?: string | null;
  comment?: string | null;
  controlled?: boolean;
  deaSchedule?: string | null;
  witnessUserId?: string | null;
  witnessName?: string | null;
  onHandBefore?: number;
  onHandAfter?: number;
  expectedCount?: number;
  actualCount?: number;
  variance?: number;
  referenceId?: string | null;
};

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function parseMetadataJson(value?: string | null): AuditEventMetadata {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as AuditEventMetadata)
      : {};
  } catch {
    return {};
  }
}

function getSeverityRank(severity: AlertSeverity) {
  if (severity === "HIGH") return 3;
  if (severity === "MEDIUM") return 2;
  return 1;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.max(1, Number(searchParams.get("days") || "30"));

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const [wasteTx, adjustEvents, cycleCountEvents, controlledAfterHoursEvents] =
      await Promise.all([
        prisma.inventoryTransaction.findMany({
          where: {
            type: "WASTE",
            occurredAt: { gte: cutoff },
          },
          include: {
            medication: true,
            location: true,
            actor: true,
          },
          orderBy: { occurredAt: "desc" },
        }),

        prisma.auditEvent.findMany({
          where: {
            occurredAt: { gte: cutoff },
            action: "ADJUST",
          },
          orderBy: { occurredAt: "desc" },
        }),

        prisma.auditEvent.findMany({
          where: {
            occurredAt: { gte: cutoff },
            action: "CYCLE_COUNT",
          },
          orderBy: { occurredAt: "desc" },
        }),

        prisma.auditEvent.findMany({
          where: {
            occurredAt: { gte: cutoff },
            category: "CONTROLLED_SUBSTANCE",
            action: { in: ["DISPENSE", "WASTE", "DISPOSE", "ADJUST", "CYCLE_COUNT"] },
          },
          orderBy: { occurredAt: "desc" },
        }),
      ]);

    const alerts: DiversionAlert[] = [];

    // High waste by medication + location
    const wasteMap = new Map<
      string,
      {
        medicationName: string | null;
        deaSchedule: string | null;
        locationName: string | null;
        actorName: string | null;
        totalWaste: number;
        eventCount: number;
        lastOccurredAt: string | null;
      }
    >();

    for (const tx of wasteTx) {
      const key = `${tx.medicationId}__${tx.locationId}`;
      const existing = wasteMap.get(key);

      if (!existing) {
        wasteMap.set(key, {
          medicationName: tx.medication?.name || null,
          deaSchedule: tx.medication?.deaSchedule || null,
          locationName: tx.location?.name || null,
          actorName: tx.actor?.name || null,
          totalWaste: Math.abs(toNumber(tx.quantity)),
          eventCount: 1,
          lastOccurredAt: tx.occurredAt.toISOString(),
        });
      } else {
        existing.totalWaste += Math.abs(toNumber(tx.quantity));
        existing.eventCount += 1;
        existing.lastOccurredAt = tx.occurredAt.toISOString();
      }
    }

    for (const [key, value] of wasteMap.entries()) {
      if (value.eventCount < 3 && value.totalWaste < 10) continue;

      const severity: AlertSeverity =
        value.eventCount >= 5 || value.totalWaste >= 20
          ? "HIGH"
          : value.eventCount >= 4 || value.totalWaste >= 10
            ? "MEDIUM"
            : "LOW";

      alerts.push({
        id: `waste-${key}`,
        category: "HIGH_WASTE",
        severity,
        title: "Elevated waste activity detected",
        detail: `${value.medicationName || "Medication"} shows ${value.eventCount} waste events totaling ${value.totalWaste} units in the selected period.`,
        medicationName: value.medicationName,
        deaSchedule: value.deaSchedule,
        locationName: value.locationName,
        actorName: value.actorName,
        eventCount: value.eventCount,
        lastOccurredAt: value.lastOccurredAt,
      });
    }

    // After-hours controlled activity from structured audit events
    const afterHoursMap = new Map<
      string,
      {
        medicationName: string | null;
        deaSchedule: string | null;
        locationName: string | null;
        actorName: string | null;
        eventCount: number;
        lastOccurredAt: string | null;
      }
    >();

    for (const event of controlledAfterHoursEvents) {
      const hour = event.occurredAt.getHours();
      const isAfterHours = hour < 5 || hour >= 22;
      if (!isAfterHours) continue;

      const key = `${event.medicationId || "unknown"}__${event.locationId || "unknown"}__${event.actorUserId || "unknown"}__${event.action}`;
      const existing = afterHoursMap.get(key);

      if (!existing) {
        afterHoursMap.set(key, {
          medicationName: event.medicationName || null,
          deaSchedule: parseMetadataJson(event.metadataJson).deaSchedule || null,
          locationName: event.locationName || null,
          actorName: event.actorName || null,
          eventCount: 1,
          lastOccurredAt: event.occurredAt.toISOString(),
        });
      } else {
        existing.eventCount += 1;
        existing.lastOccurredAt = event.occurredAt.toISOString();
      }
    }

    for (const [key, value] of afterHoursMap.entries()) {
      const severity: AlertSeverity =
        value.eventCount >= 3 ? "HIGH" : value.eventCount >= 2 ? "MEDIUM" : "LOW";

      alerts.push({
        id: `afterhours-${key}`,
        category: "AFTER_HOURS_CONTROLLED",
        severity,
        title: "After-hours controlled-substance activity detected",
        detail: `${value.eventCount} controlled-medication events occurred during after-hours review windows.`,
        medicationName: value.medicationName,
        deaSchedule: value.deaSchedule,
        locationName: value.locationName,
        actorName: value.actorName,
        eventCount: value.eventCount,
        lastOccurredAt: value.lastOccurredAt,
      });
    }

    // Frequent adjustments from audit events
    const adjustMap = new Map<
      string,
      {
        medicationName: string | null;
        deaSchedule: string | null;
        locationName: string | null;
        actorName: string | null;
        eventCount: number;
        addCount: number;
        subtractCount: number;
        lastOccurredAt: string | null;
      }
    >();

    for (const event of adjustEvents) {
      const metadata = parseMetadataJson(event.metadataJson);
      const key = `${event.medicationId || "unknown"}__${event.locationId || "unknown"}`;
      const existing = adjustMap.get(key);
      const isAdd = metadata.adjustmentType === "ADD";
      const isSubtract = metadata.adjustmentType === "SUBTRACT";

      if (!existing) {
        adjustMap.set(key, {
          medicationName: event.medicationName || null,
          deaSchedule: metadata.deaSchedule || null,
          locationName: event.locationName || null,
          actorName: event.actorName || null,
          eventCount: 1,
          addCount: isAdd ? 1 : 0,
          subtractCount: isSubtract ? 1 : 0,
          lastOccurredAt: event.occurredAt.toISOString(),
        });
      } else {
        existing.eventCount += 1;
        existing.addCount += isAdd ? 1 : 0;
        existing.subtractCount += isSubtract ? 1 : 0;
        existing.lastOccurredAt = event.occurredAt.toISOString();
      }
    }

    for (const [key, value] of adjustMap.entries()) {
      if (value.eventCount < 3) continue;

      const severity: AlertSeverity =
        value.eventCount >= 6
          ? "HIGH"
          : value.eventCount >= 4
            ? "MEDIUM"
            : "LOW";

      alerts.push({
        id: `adjust-${key}`,
        category: "FREQUENT_ADJUSTMENTS",
        severity,
        title: "Frequent inventory adjustments detected",
        detail: `${value.medicationName || "Medication"} has ${value.eventCount} adjustment events in the selected period (${value.addCount} add, ${value.subtractCount} subtract).`,
        medicationName: value.medicationName,
        deaSchedule: value.deaSchedule,
        locationName: value.locationName,
        actorName: value.actorName,
        eventCount: value.eventCount,
        lastOccurredAt: value.lastOccurredAt,
      });
    }

    // Repeated variance from cycle counts
    const varianceMap = new Map<
      string,
      {
        medicationName: string | null;
        deaSchedule: string | null;
        locationName: string | null;
        actorName: string | null;
        eventCount: number;
        totalAbsoluteVariance: number;
        lastVariance: number;
        lastOccurredAt: string | null;
      }
    >();

    for (const event of cycleCountEvents) {
      const metadata = parseMetadataJson(event.metadataJson);
      const variance = toNumber(metadata.variance);

      if (variance === 0) continue;

      const key = `${event.medicationId || "unknown"}__${event.locationId || "unknown"}`;
      const existing = varianceMap.get(key);

      if (!existing) {
        varianceMap.set(key, {
          medicationName: event.medicationName || null,
          deaSchedule: metadata.deaSchedule || null,
          locationName: event.locationName || null,
          actorName: event.actorName || null,
          eventCount: 1,
          totalAbsoluteVariance: Math.abs(variance),
          lastVariance: variance,
          lastOccurredAt: event.occurredAt.toISOString(),
        });
      } else {
        existing.eventCount += 1;
        existing.totalAbsoluteVariance += Math.abs(variance);
        existing.lastVariance = variance;
        existing.lastOccurredAt = event.occurredAt.toISOString();
      }
    }

    for (const [key, value] of varianceMap.entries()) {
      if (value.eventCount < 2) continue;

      const severity: AlertSeverity =
        value.eventCount >= 4 || value.totalAbsoluteVariance >= 20
          ? "HIGH"
          : value.eventCount >= 3 || value.totalAbsoluteVariance >= 10
            ? "MEDIUM"
            : "LOW";

      alerts.push({
        id: `variance-${key}`,
        category: "REPEATED_VARIANCE",
        severity,
        title: "Repeated cycle count variance detected",
        detail: `${value.medicationName || "Medication"} has ${value.eventCount} cycle count variances totaling ${value.totalAbsoluteVariance} units in the selected period. Latest variance: ${value.lastVariance}.`,
        medicationName: value.medicationName,
        deaSchedule: value.deaSchedule,
        locationName: value.locationName,
        actorName: value.actorName,
        eventCount: value.eventCount,
        lastOccurredAt: value.lastOccurredAt,
      });
    }

    alerts.sort((a, b) => {
      const severityDiff = getSeverityRank(b.severity) - getSeverityRank(a.severity);
      if (severityDiff !== 0) return severityDiff;
      return String(b.lastOccurredAt || "").localeCompare(String(a.lastOccurredAt || ""));
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Failed to load diversion alerts", error);
    return NextResponse.json(
      { error: "Failed to load diversion alerts" },
      { status: 500 }
    );
  }
}
