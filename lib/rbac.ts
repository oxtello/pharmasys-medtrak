export type UserRole =
  | "ADMIN"
  | "PHARMACIST"
  | "TECHNICIAN"
  | "NURSE_MANAGER"
  | "AUDITOR";

export type Permission =
  | "inventory.view"
  | "inventory.receive"
  | "inventory.dispense"
  | "inventory.transfer"
  | "inventory.adjust"
  | "inventory.waste"
  | "inventory.dispose"
  | "inventory.cycle_count"
  | "reports.view"
  | "reports.export"
  | "medication_master.view"
  | "medication_master.manage"
  | "users.manage"
  | "audit.view"
  | "controlled_substances.handle"
  | "controlled_substances.dispose"
  | "controlled_substances.adjust";

export type AppUser = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: UserRole;
  homeLocationId: string;
  homeLocationName: string;
  activeLocationId: string;
  activeLocationName: string;
  isActive: boolean;
};

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    "inventory.view",
    "inventory.receive",
    "inventory.dispense",
    "inventory.transfer",
    "inventory.adjust",
    "inventory.waste",
    "inventory.dispose",
    "inventory.cycle_count",
    "reports.view",
    "reports.export",
    "medication_master.view",
    "medication_master.manage",
    "users.manage",
    "audit.view",
    "controlled_substances.handle",
    "controlled_substances.dispose",
    "controlled_substances.adjust",
  ],

  PHARMACIST: [
    "inventory.view",
    "inventory.receive",
    "inventory.dispense",
    "inventory.transfer",
    "inventory.adjust",
    "inventory.waste",
    "inventory.dispose",
    "inventory.cycle_count",
    "reports.view",
    "reports.export",
    "medication_master.view",
    "audit.view",
    "controlled_substances.handle",
    "controlled_substances.dispose",
    "controlled_substances.adjust",
  ],

  TECHNICIAN: [
    "inventory.view",
    "inventory.receive",
    "inventory.dispense",
    "inventory.transfer",
    "inventory.waste",
    "inventory.cycle_count",
    "reports.view",
    "medication_master.view",
  ],

  NURSE_MANAGER: [
    "inventory.view",
    "inventory.receive",
    "inventory.dispense",
    "inventory.transfer",
    "inventory.waste",
    "inventory.cycle_count",
    "reports.view",
    "reports.export",
    "medication_master.view",
  ],

  AUDITOR: [
    "inventory.view",
    "reports.view",
    "audit.view",
    "medication_master.view",
  ],
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

export function normalizeUserRole(value: unknown): UserRole {
  const normalized = normalizeUpper(value);

  switch (normalized) {
    case "ADMIN":
      return "ADMIN";
    case "PHARMACIST":
      return "PHARMACIST";
    case "TECHNICIAN":
      return "TECHNICIAN";
    case "NURSE_MANAGER":
    case "NURSE MANAGER":
      return "NURSE_MANAGER";
    case "AUDITOR":
      return "AUDITOR";
    default:
      return "TECHNICIAN";
  }
}

export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(
  user: Pick<AppUser, "role" | "isActive"> | null | undefined,
  permission: Permission
): boolean {
  if (!user || !user.isActive) return false;
  return getRolePermissions(user.role).includes(permission);
}

export function requirePermission(
  user: Pick<AppUser, "role" | "isActive"> | null | undefined,
  permission: Permission
) {
  if (!hasPermission(user, permission)) {
    throw new Error("You do not have permission to perform this action.");
  }
}

export function canManageMedicationMaster(
  user: Pick<AppUser, "role" | "isActive"> | null | undefined
) {
  return hasPermission(user, "medication_master.manage");
}

export function canAdjustInventory(
  user: Pick<AppUser, "role" | "isActive"> | null | undefined
) {
  return hasPermission(user, "inventory.adjust");
}

export function canDisposeMedication(
  user: Pick<AppUser, "role" | "isActive"> | null | undefined
) {
  return hasPermission(user, "inventory.dispose");
}

export function canHandleControlledSubstances(
  user: Pick<AppUser, "role" | "isActive"> | null | undefined
) {
  return hasPermission(user, "controlled_substances.handle");
}

export function canAdjustControlledSubstances(
  user: Pick<AppUser, "role" | "isActive"> | null | undefined
) {
  return hasPermission(user, "controlled_substances.adjust");
}

export function canDisposeControlledSubstances(
  user: Pick<AppUser, "role" | "isActive"> | null | undefined
) {
  return hasPermission(user, "controlled_substances.dispose");
}

export function isReadOnlyRole(
  user: Pick<AppUser, "role"> | null | undefined
): boolean {
  return user?.role === "AUDITOR";
}

export function isSameActiveLocation(
  user: Pick<AppUser, "activeLocationId"> | null | undefined,
  locationId: string
) {
  return normalizeText(user?.activeLocationId) === normalizeText(locationId);
}
