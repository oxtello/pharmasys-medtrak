import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const locationId = searchParams.get("locationId") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const where: any = {};

    if (locationId) where.locationId = locationId;

    if (startDate || endDate) {
      where.finalizedAt = {};

      if (startDate) {
        where.finalizedAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      }

      if (endDate) {
        where.finalizedAt.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    const reports = await prisma.reconciliationReport.findMany({
      where,
      orderBy: {
        finalizedAt: "desc",
      },
      include: {
        location: true,
      },
      take: 100,
    });

    return NextResponse.json({
      reports,
    });
  } catch (error) {
    console.error("Reconciliation history error:", error);

    return NextResponse.json(
      { error: "Failed to load reconciliation history" },
      { status: 500 }
    );
  }
}
