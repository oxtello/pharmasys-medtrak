import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

type UpdateUserBody = {
  role?: "ADMIN" | "PHARMACIST" | "TECHNICIAN" | "NURSE" | "AUDITOR";
  homeLocationId?: string;
  isActive?: boolean;
};

function normalizeText(value?: string | null) {
  return String(value ?? "").trim();
}

function isValidRole(value?: string): value is UpdateUserBody["role"] {
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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();

    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const userId = normalizeText(id);

    if (!userId) {
      return NextResponse.json({ error: "User id is required" }, { status: 400 });
    }

    const body = (await req.json()) as UpdateUserBody;

    const hasRole = body.role !== undefined;
    const hasHomeLocation = body.homeLocationId !== undefined;
    const hasIsActive = body.isActive !== undefined;

    if (!hasRole && !hasHomeLocation && !hasIsActive) {
      return NextResponse.json(
        { error: "No updates were provided" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: {
      role?: UpdateUserBody["role"];
      homeLocationId?: string | null;
      isActive?: boolean;
    } = {};

    if (hasRole) {
      const role = normalizeText(body.role);
      if (!isValidRole(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      updateData.role = role;
    }

    if (hasHomeLocation) {
      const homeLocationId = normalizeText(body.homeLocationId);

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

        updateData.homeLocationId = homeLocationId;
      } else {
        updateData.homeLocationId = null;
      }
    }

    if (hasIsActive) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json(
          { error: "isActive must be boolean" },
          { status: 400 }
        );
      }

      if (existingUser.id === auth.actor.id && body.isActive === false) {
        return NextResponse.json(
          { error: "You cannot deactivate your own account" },
          { status: 400 }
        );
      }

      if (existingUser.role === "ADMIN" && body.isActive === false) {
        const activeAdminCount = await prisma.user.count({
          where: {
            role: "ADMIN",
            isActive: true,
          },
        });

        if (activeAdminCount <= 1) {
          return NextResponse.json(
            { error: "You cannot deactivate the last active admin" },
            { status: 400 }
          );
        }
      }

      updateData.isActive = body.isActive;
    }

    if (
      existingUser.role === "ADMIN" &&
      ((updateData.role && updateData.role !== "ADMIN") ||
        (updateData.isActive === false))
    ) {
      const activeAdmins = await prisma.user.count({
        where: {
          role: "ADMIN",
          isActive: true,
        },
      });

      if (activeAdmins <= 1) {
        return NextResponse.json(
          { error: "You cannot remove or deactivate the last active admin" },
          { status: 400 }
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
        action: "USER_UPDATED",
        actorUserId: auth.actor.id,
        actorName: auth.actor.name,
        entityType: "User",
        entityId: updatedUser.id,
        details: [
          `Updated user: ${updatedUser.name}`,
          updateData.role ? `Role: ${existingUser.role} -> ${updatedUser.role}` : null,
          hasHomeLocation
            ? `Home location: ${existingUser.homeLocationId || "None"} -> ${
                updatedUser.homeLocationId || "None"
              }`
            : null,
          hasIsActive
            ? `Active: ${existingUser.isActive ? "Yes" : "No"} -> ${
                updatedUser.isActive ? "Yes" : "No"
              }`
            : null,
        ]
          .filter(Boolean)
          .join(" | "),
        metadataJson: JSON.stringify({
          userId: updatedUser.id,
          previousRole: existingUser.role,
          newRole: updatedUser.role,
          previousHomeLocationId: existingUser.homeLocationId,
          newHomeLocationId: updatedUser.homeLocationId,
          previousIsActive: existingUser.isActive,
          newIsActive: updatedUser.isActive,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        homeLocationId: updatedUser.homeLocationId,
        homeLocationName: updatedUser.homeLocation?.name || null,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("ADMIN_USER_PATCH_ERROR", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update user",
      },
      { status: 500 }
    );
  }
}
