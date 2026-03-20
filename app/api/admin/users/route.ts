import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CreateUserBody = {
  name?: string;
  email?: string;
  role?: "ADMIN" | "PHARMACIST" | "TECHNICIAN" | "NURSE" | "AUDITOR";
  homeLocationId?: string;
  isActive?: boolean;
};

function normalizeText(value?: string | null) {
  return String(value ?? "").trim();
}

function isValidRole(value?: string): value is CreateUserBody["role"] {
  return ["ADMIN", "PHARMACIST", "TECHNICIAN", "NURSE", "AUDITOR"].includes(
    String(value)
  );
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const actor = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!actor || !actor.isActive) {
    return { error: "User not found", status: 401 as const };
  }

  if (actor.role !== "ADMIN") {
    return { error: "Only admins can manage users", status: 403 as const };
  }

  return { actor };
}

export async function GET() {
  try {
    const auth = await requireAdmin();

    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const users = await prisma.user.findMany({
      include: {
        homeLocation: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        homeLocationId: user.homeLocationId,
        homeLocationName: user.homeLocation?.name || null,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("ADMIN_USERS_GET_ERROR", error);

    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();

    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await req.json()) as CreateUserBody;

    const name = normalizeText(body.name);
    const email = normalizeText(body.email).toLowerCase();
    const role = normalizeText(body.role);
    const homeLocationId = normalizeText(body.homeLocationId);
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : true;

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: "name, email, and role are required" },
        { status: 400 }
      );
    }

    if (!isValidRole(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (homeLocationId) {
      const location = await prisma.location.findUnique({
        where: { id: homeLocationId },
      });

      if (!location || !location.isActive) {
        return NextResponse.json(
          { error: "Selected home location was not found or is inactive" },
          { status: 400 }
        );
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with that email already exists" },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        homeLocationId: homeLocationId || null,
        isActive,
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

    await prisma.auditEvent.create({
      data: {
        category: "REPORTING",
        action: "USER_CREATED",
        actorUserId: auth.actor.id,
        actorName: auth.actor.name,
        entityType: "User",
        entityId: user.id,
        details: [
          `Created user: ${user.name}`,
          `Email: ${user.email}`,
          `Role: ${user.role}`,
          user.homeLocation?.name ? `Home location: ${user.homeLocation.name}` : null,
          `Active: ${user.isActive ? "Yes" : "No"}`,
        ]
          .filter(Boolean)
          .join(" | "),
        metadataJson: JSON.stringify({
          userId: user.id,
          email: user.email,
          role: user.role,
          homeLocationId: user.homeLocationId,
          isActive: user.isActive,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        homeLocationId: user.homeLocationId,
        homeLocationName: user.homeLocation?.name || null,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("ADMIN_USERS_POST_ERROR", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create user",
      },
      { status: 500 }
    );
  }
}
