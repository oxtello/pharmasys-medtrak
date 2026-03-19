import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit-events";

type FinalizeRowInput = {
  medicationId: string;
  medicationName: string;
  strength?: string | null;
  dosageForm?: string | null;
  deaSchedule?: string | null;
  locationId: string;
  locationName: string;
  beginningBalance: number;
  receipts: number;
  transfersIn: number;
  dispensed: number;
  waste: number;
  dispose: number;
  transfersOut: number;
  adjustments: number;
  expectedEndingBalance: number;
  physicalCount: number | null;
  variance: number | null;
  notes?: string | null;
  status: string;
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!actor || !actor.isActive) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const body = await req.json();

    const {
      reviewTiming,
      reviewerRole,
      reviewerName,
      locationId,
      startDate,
      endDate,
      search,
      deaSchedules,
      discrepancyOnly,
      rows,
    }: {
      reviewTiming?: string;
      reviewerRole?: string;
      reviewerName?: string;
      locationId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      deaSchedules?: string[];
      discrepancyOnly?: boolean;
      rows?: FinalizeRowInput[];
    } = body;

    if (!locationId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "locationId, startDate, and endDate are required" },
        { status: 400 }
      );
    }

    if (!reviewerName?.trim()) {
      return NextResponse.json(
        { error: "Reviewer name is required before finalizing." },
        { status: 400 }
      );
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "At least one reconciliation row is required." },
        { status: 400 }
      );
    }

    const pendingCounts = rows.filter(
      (row) => row.physicalCount === null || row.physicalCount === undefined
    );

    if (pendingCounts.length > 0) {
      return NextResponse.json(
        { error: "All rows must have a physical count before finalizing." },
        { status: 400 }
      );
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location || !location.isActive) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const finalizedTimestamp = new Date();

    const report = await prisma.$transaction(async (tx) => {
      const createdReport = await tx.reconciliationReport.create({
        data: {
          locationId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          reviewTiming: reviewTiming || "BOD",
          reviewerRole: reviewerRole || "Pharmacist Consultant",
          reviewerName: reviewerName.trim(),
          search: search?.trim() || null,
          deaSchedules:
            Array.isArray(deaSchedules) && deaSchedules.length
              ? deaSchedules.join(",")
              : null,
          discrepancyOnly: Boolean(discrepancyOnly),
          finalized: true,
          finalizedAt: finalizedTimestamp,
          rows: {
            create: rows.map((row) => ({
              medicationId: row.medicationId,
              medicationName: row.medicationName,
              strength: row.strength || null,
              dosageForm: row.dosageForm || null,
              deaSchedule: row.deaSchedule || null,
              locationId: row.locationId,
              locationName: row.locationName,
              beginningBalance: Number(row.beginningBalance || 0).toString(),
              receipts: Number(row.receipts || 0).toString(),
              transfersIn: Number(row.transfersIn || 0).toString(),
              dispensed: Number(row.dispensed || 0).toString(),
              waste: Number(row.waste || 0).toString(),
              dispose: Number(row.dispose || 0).toString(),
              transfersOut: Number(row.transfersOut || 0).toString(),
              adjustments: Number(row.adjustments || 0).toString(),
              expectedEndingBalance: Number(row.expectedEndingBalance || 0).toString(),
              physicalCount:
                row.physicalCount === null || row.physicalCount === undefined
                  ? null
                  : Number(row.physicalCount).toString(),
              variance:
                row.variance === null || row.variance === undefined
                  ? null
                  : Number(row.variance).toString(),
              notes: row.notes || null,
              status: row.status,
            })),
          },
        },
        include: {
          rows: true,
        },
      });

      return createdReport;
    });

    const varianceCount = report.rows.filter(
      (row) => Number(row.variance ?? 0) !== 0
    ).length;

    await logAuditEvent({
      occurredAt: finalizedTimestamp,
      category: "Reconciliation",
      action: "FINALIZED",
      actorUserId: actor.id,
      actorName: actor.name,
      locationId: location.id,
      locationName: location.name,
      reconciliationReportId: report.id,
      entityType: "ReconciliationReport",
      entityId: report.id,
      details: [
        `${startDate} to ${endDate}`,
        report.reviewTiming === "BOD" ? "Beginning of Day" : "End of Day",
        report.reviewerRole,
        `${report.rows.length} rows`,
        `${varianceCount} variances`,
      ]
        .filter(Boolean)
        .join(" • "),
      metadata: {
        reportId: report.id,
        locationId: location.id,
        locationName: location.name,
        reviewerRole: report.reviewerRole,
        reviewerName: report.reviewerName,
        reviewTiming: report.reviewTiming,
        startDate,
        endDate,
        search: search?.trim() || "",
        deaSchedules: Array.isArray(deaSchedules) ? deaSchedules : [],
        discrepancyOnly: Boolean(discrepancyOnly),
        rowCount: report.rows.length,
        varianceCount,
      },
    });

    await logAuditEvent({
      occurredAt: finalizedTimestamp,
      category: "Reporting",
      action: "RECONCILIATION_REPORT_AVAILABLE",
      actorUserId: actor.id,
      actorName: actor.name,
      locationId: location.id,
      locationName: location.name,
      reconciliationReportId: report.id,
      entityType: "ReconciliationReport",
      entityId: report.id,
      details: "Finalized reconciliation available for PDF export and audit review.",
      metadata: {
        reportId: report.id,
        locationId: location.id,
        locationName: location.name,
      },
    });

    return NextResponse.json({
      success: true,
      reportId: report.id,
      finalizedAt: finalizedTimestamp.toISOString(),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to finalize reconciliation" },
      { status: 500 }
    );
  }
}
