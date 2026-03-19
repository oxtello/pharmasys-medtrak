import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeCategory(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const category = normalizeCategory(searchParams.get("category"));
    const takeParam = Number(searchParams.get("take") || "250");
    const take = Number.isFinite(takeParam)
      ? Math.min(Math.max(takeParam, 1), 1000)
      : 250;

    const auditEvents = await prisma.auditEvent.findMany({
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take,
      select: {
        id: true,
        occurredAt: true,
        category: true,
        action: true,
        actorName: true,
        locationName: true,
        medicationName: true,
        details: true,
        entityType: true,
        entityId: true,
        inventoryTransactionId: true,
        reconciliationReportId: true,
        metadataJson: true,
      },
    });

    const mappedEvents = auditEvents.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      category: row.category || "INVENTORY",
      action: row.action,
      actorName: row.actorName || null,
      locationName: row.locationName || null,
      medicationName: row.medicationName || null,
      details: row.details || null,
      entityType: row.entityType || null,
      entityId: row.entityId || null,
      inventoryTransactionId: row.inventoryTransactionId || null,
      reconciliationReportId: row.reconciliationReportId || null,
      metadataJson: row.metadataJson || null,
    }));

    const filteredEvents = mappedEvents.filter((row) => {
      const rowCategory = normalizeCategory(row.category);

      const matchesCategory =
        !category || category === "ALL" ? true : rowCategory === category;

      if (!matchesCategory) return false;

      if (!search) return true;

      const haystack = [
        row.category,
        row.action,
        row.actorName,
        row.locationName,
        row.medicationName,
        row.details,
        row.entityType,
        row.entityId,
        row.inventoryTransactionId,
        row.reconciliationReportId,
        row.metadataJson,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });

    return NextResponse.json({ events: filteredEvents });
  } catch (error) {
    console.error("Failed to load system activity", error);
    return NextResponse.json(
      { error: "Failed to load system activity" },
      { status: 500 }
    );
  }
}
