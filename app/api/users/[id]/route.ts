import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { generateTempPassword, hashPassword } from "@/lib/password";

function isAdminLike(role?: string | null) {
  return role === "ADMIN" || role === "PHARMACIST";
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!actor || !actor.isActive || !isAdminLike(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: any = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      updates.name = name;
    }

    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!email) {
        return NextResponse.json({ error: "Email cannot be empty" }, { status: 400 });
      }

      const emailOwner = await prisma.user.findUnique({
        where: { email },
      });

      if (emailOwner && emailOwner.id !== id) {
        return NextResponse.json(
          { error: "Another user already has that email" },
          { status: 409 }
        );
      }

      updates.email = email;
    }

    if (body.role !== undefined) {
      const role = String(body.role).trim().toUpperCase();

      const validRoles = [
        "ADMIN",
        "PHARMACIST",
        "MEDICAL_ASSISTANT",
        "LICENSED_VOCATIONAL_NURSE",
        "TECHNICIAN",
        "REGISTERED_NURSE",
        "PROVIDER",
      ];

      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }

      updates.role = role;
    }

    if (body.isActive !== undefined) {
      updates.isActive = Boolean(body.isActive);
    }

    if (body.homeLocationId !== undefined) {
      const homeLocationId =
        body.homeLocationId && String(body.homeLocationId).trim()
          ? String(body.homeLocationId).trim()
          : null;

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

      updates.homeLocationId = homeLocationId;
    }

    let tempPassword: string | null = null;

    if (body.password !== undefined) {
      const password = String(body.password ?? "").trim();

      if (!password) {
        return NextResponse.json(
          { error: "Password cannot be empty" },
          { status: 400 }
        );
      }

      updates.passwordHash = hashPassword(password);
    }

    if (body.generateTempPassword) {
      tempPassword = generateTempPassword();
      updates.passwordHash = hashPassword(tempPassword);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updates,
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
    console.error("PATCH /api/users/[id] error", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
