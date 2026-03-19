import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "OPEN";

    const tasks = await prisma.cycleCountTask.findMany({
      where: {
        status,
      },
      include: {
        medication: {
          select: {
            name: true,
            strength: true,
            dosageForm: true,
            deaSchedule: true,
          },
        },
        location: {
          select: {
            name: true,
          },
        },
        completedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { scheduledFor: "asc" },
        { riskScore: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Failed to load cycle count tasks", error);

    return NextResponse.json(
      { error: "Failed to load cycle count tasks" },
      { status: 500 }
    );
  }
}
