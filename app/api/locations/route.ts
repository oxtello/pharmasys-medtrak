import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const locations = await prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    return NextResponse.json({ locations });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load locations" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body?.name || "").trim();
    const code = String(body?.code || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Location name is required" },
        { status: 400 }
      );
    }

    const existingByName = await prisma.location.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existingByName) {
      return NextResponse.json(
        { error: "A location with that name already exists" },
        { status: 400 }
      );
    }

    if (code) {
      const existingByCode = await prisma.location.findFirst({
        where: {
          code: {
            equals: code,
            mode: "insensitive",
          },
        },
      });

      if (existingByCode) {
        return NextResponse.json(
          { error: "A location with that code already exists" },
          { status: 400 }
        );
      }
    }

    const location = await prisma.location.create({
      data: {
        name,
        code: code || null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
      },
    });

    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create location" },
      { status: 500 }
    );
  }
}
