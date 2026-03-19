import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function ensureTestLocation() {
  const existing = await prisma.location.findFirst({
    where: { code: "ER", isActive: true },
  });

  if (existing) {
    return { location: existing, created: false };
  }

  const created = await prisma.location.create({
    data: {
      name: "ER",
      code: "ER",
      isActive: true,
    },
  });

  return { location: created, created: true };
}

export async function GET() {
  try {
    const result = await ensureTestLocation();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Add test location GET error:", error);
    return NextResponse.json(
      { error: "Failed to create test location" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await ensureTestLocation();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Add test location POST error:", error);
    return NextResponse.json(
      { error: "Failed to create test location" },
      { status: 500 }
    );
  }
}
