import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const completedByUserId =
      typeof body.completedByUserId === "string" ? body.completedByUserId : null;

    const countedBy =
      typeof body.countedBy === "string" ? body.countedBy.trim() : "";

    const expectedQuantity = toNumber(body.expectedQuantity);
    const actualQuantity = toNumber(body.actualQuantity);
    const variance = toNumber(body.variance);
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    const task = await prisma.cycleCountTask.findUnique({
      where: { id },
      include: {
        medication: true,
        location: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Cycle count task not found" },
        { status: 404 }
      );
    }

    if (task.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cycle count task already completed" },
        { status: 409 }
      );
    }

    const occurredAt = new Date();

    const noteParts = [
      `Expected: ${expectedQuantity}`,
      `Actual: ${actualQuantity}`,
      `Variance: ${variance}`,
      countedBy ? `Counted By: ${countedBy}` : "",
      notes ? `Comment: ${notes}` : "",
      `Cycle Count Task: ${task.id}`,
    ].filter(Boolean);

    const [updatedTask, createdTransaction] = await prisma.$transaction([
      prisma.cycleCountTask.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: occurredAt,
          completedByUserId,
        },
      }),

      prisma.inventoryTransaction.create({
        data: {
          type: "CYCLE_COUNT",
          occurredAt,
          medicationId: task.medicationId,
          locationId: task.locationId,
          actorUserId: completedByUserId,
          quantity: 0,
          note: noteParts.join(" | "),
        },
      }),
    ]);

    return NextResponse.json({
      task: updatedTask,
      transaction: createdTransaction,
    });
  } catch (error) {
    console.error("Failed to complete cycle count task", error);
    return NextResponse.json(
      { error: "Failed to complete cycle count task" },
      { status: 500 }
    );
  }
}
