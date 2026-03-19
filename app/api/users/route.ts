import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { generateTempPassword, hashPassword } from "@/lib/password";

const VALID_ROLES = [
  "ADMIN",
  "PHARMACIST",
  "MEDICAL_ASSISTANT",
  "LICENSED_VOCATIONAL_NURSE",
  "TECHNICIAN",
  "REGISTERED_NURSE",
  "PROVIDER",
  "AUDITOR",
  "NURSE",
] as const;

function isAdmin(role?: string | null) {
  return role === "ADMIN";
}

function isValidRole(role: string): role is (typeof VALID_ROLES)[number] {
  return VALID_ROLES.includes(role as (typeof VALID_ROLES)[number]);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!actor || !actor.isActive || !isAdmin(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        homeLocation: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        homeLocationId: user.homeLocationId,
        homeLocation: user.homeLocation,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/users error", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load users",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!actor || !actor.isActive || !isAdmin(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const role = String(body?.role ?? "").trim().toUpperCase();
    const homeLocationId =
      body?.homeLocationId && String(body.homeLocationId).trim()
        ? String(body.homeLocationId).trim()
        : null;
    const password = String(body?.password ?? "").trim();
    const generatePassword = Boolean(body?.generateTempPassword);
    const isActive =
      body?.isActive === undefined ? true : Boolean(body.isActive);

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: "Name, email, and role are required" },
        { status: 400 }
      );
    }

    if (!isValidRole(role)) {
      return NextResponse.json(
        { error: `Invalid role: ${role}` },
        { status: 400 }
      );
    }

    if (homeLocationId) {
      const location = await prisma.location.findUnique({
        where: { id: homeLocationId },
      });

      if (!location) {
        return NextResponse.json(
          { error: "Selected home location was not found" },
          { status: 400 }
        );
      }
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A user with that email already exists" },
        { status: 409 }
      );
    }

    let tempPassword: string | null = null;
    let passwordHash: string | null = null;

    if (password) {
      passwordHash = hashPassword(password);
    } else if (generatePassword) {
      tempPassword = generateTempPassword();
      passwordHash = hashPassword(tempPassword);
    } else {
      return NextResponse.json(
        { error: "Provide a password or generate a temporary password" },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        isActive,
        homeLocationId,
        passwordHash,
      },
      include: {
        homeLocation: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        homeLocationId: user.homeLocationId,
        homeLocation: user.homeLocation,
      },
      tempPassword,
    });
  } catch (error) {
    console.error("POST /api/users error", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create user",
      },
      { status: 500 }
    );
  }
}
