import type { UserRole } from "@/lib/mock-session";

export type RolePermissions = {
  canReceive: boolean;
  canDispense: boolean;
  canAdjust: boolean;
  canDispose: boolean;
  canManageUsers: boolean;
};

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  Nurse: {
    canReceive: true,
    canDispense: true,
    canAdjust: true,
    canDispose: true,
    canManageUsers: false,
  },
  MA: {
    canReceive: true,
    canDispense: false,
    canAdjust: false,
    canDispose: false,
    canManageUsers: false,
  },
  Provider: {
    canReceive: false,
    canDispense: true,
    canAdjust: false,
    canDispose: false,
    canManageUsers: false,
  },
  Admin: {
    canReceive: true,
    canDispense: true,
    canAdjust: true,
    canDispose: true,
    canManageUsers: true,
  },
};

export function getPermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}
