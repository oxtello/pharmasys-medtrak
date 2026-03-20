export type UserRole =
  | "ADMIN"
  | "PHARMACIST"
  | "MEDICAL_ASSISTANT"
  | "LICENSED_VOCATIONAL_NURSE"
  | "TECHNICIAN"
  | "REGISTERED_NURSE"
  | "PROVIDER"
  | "AUDITOR"
  | "NURSE";

export type RolePermissions = {
  canReceive: boolean;
  canDispense: boolean;
  canAdjust: boolean;
  canDispose: boolean;
  canManageUsers: boolean;
};

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  ADMIN: {
    canReceive: true,
    canDispense: true,
    canAdjust: true,
    canDispose: true,
    canManageUsers: true,
  },
  PHARMACIST: {
    canReceive: true,
    canDispense: true,
    canAdjust: true,
    canDispose: true,
    canManageUsers: false,
  },
  MEDICAL_ASSISTANT: {
    canReceive: true,
    canDispense: true,
    canAdjust: true,
    canDispose: true,
    canManageUsers: false,
  },
  LICENSED_VOCATIONAL_NURSE: {
    canReceive: true,
    canDispense: true,
    canAdjust: true,
    canDispose: true,
    canManageUsers: false,
  },
  TECHNICIAN: {
    canReceive: true,
    canDispense: true,
    canAdjust: true,
    canDispose: true,
    canManageUsers: false,
  },
  REGISTERED_NURSE: {
    canReceive: true,
    canDispense: true,
    canAdjust: true,
    canDispose: true,
    canManageUsers: false,
  },
  PROVIDER: {
    canReceive: true,
    canDispense: true,
    canAdjust: true,
    canDispose: true,
    canManageUsers: false,
  },
  AUDITOR: {
    canReceive: true,
    canDispense: true,
    canAdjust: true,
    canDispose: true,
    canManageUsers: false,
  },
  NURSE: {
    canReceive: true,
    canDispense: true,
    canAdjust: true,
    canDispose: true,
    canManageUsers: false,
  },
};

export function getPermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}
