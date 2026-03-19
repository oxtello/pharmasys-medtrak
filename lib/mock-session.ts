import { type AppUser, normalizeUserRole, type UserRole } from "@/lib/rbac";

export const MOCK_SESSION_STORAGE_KEY = "medtrak-current-user";

type MockUserSeed = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  homeLocationId: string;
  homeLocationName: string;
  activeLocationId: string;
  activeLocationName: string;
  isActive: boolean;
};

const DEFAULT_USER: MockUserSeed = {
  id: "user-0001",
  firstName: "Alex",
  lastName: "Morgan",
  email: "alex.morgan@medtrak.local",
  role: "ADMIN",
  homeLocationId: "loc-main",
  homeLocationName: "Main Clinic",
  activeLocationId: "loc-main",
  activeLocationName: "Main Clinic",
  isActive: true,
};

const MOCK_USERS: MockUserSeed[] = [
  DEFAULT_USER,
  {
    id: "user-0002",
    firstName: "Priya",
    lastName: "Patel",
    email: "priya.patel@medtrak.local",
    role: "PHARMACIST",
    homeLocationId: "loc-main",
    homeLocationName: "Main Clinic",
    activeLocationId: "loc-main",
    activeLocationName: "Main Clinic",
    isActive: true,
  },
  {
    id: "user-0003",
    firstName: "Jordan",
    lastName: "Lee",
    email: "jordan.lee@medtrak.local",
    role: "TECHNICIAN",
    homeLocationId: "loc-main",
    homeLocationName: "Main Clinic",
    activeLocationId: "loc-main",
    activeLocationName: "Main Clinic",
    isActive: true,
  },
  {
    id: "user-0004",
    firstName: "Taylor",
    lastName: "Brooks",
    email: "taylor.brooks@medtrak.local",
    role: "NURSE_MANAGER",
    homeLocationId: "loc-north",
    homeLocationName: "North Clinic",
    activeLocationId: "loc-north",
    activeLocationName: "North Clinic",
    isActive: true,
  },
  {
    id: "user-0005",
    firstName: "Morgan",
    lastName: "Chen",
    email: "morgan.chen@medtrak.local",
    role: "AUDITOR",
    homeLocationId: "loc-main",
    homeLocationName: "Main Clinic",
    activeLocationId: "loc-main",
    activeLocationName: "Main Clinic",
    isActive: true,
  },
];

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function buildFullName(firstName: string, lastName: string) {
  return `${normalizeText(firstName)} ${normalizeText(lastName)}`.trim();
}

function normalizeUser(input: Partial<AppUser>): AppUser {
  const firstName = normalizeText(input.firstName) || "User";
  const lastName = normalizeText(input.lastName) || "";
  const fullName =
    normalizeText(input.fullName) || buildFullName(firstName, lastName);

  return {
    id: normalizeText(input.id) || DEFAULT_USER.id,
    firstName,
    lastName,
    fullName,
    email: normalizeText(input.email) || DEFAULT_USER.email,
    role: normalizeUserRole(input.role),
    homeLocationId:
      normalizeText(input.homeLocationId) || DEFAULT_USER.homeLocationId,
    homeLocationName:
      normalizeText(input.homeLocationName) || DEFAULT_USER.homeLocationName,
    activeLocationId:
      normalizeText(input.activeLocationId) ||
      normalizeText(input.homeLocationId) ||
      DEFAULT_USER.activeLocationId,
    activeLocationName:
      normalizeText(input.activeLocationName) ||
      normalizeText(input.homeLocationName) ||
      DEFAULT_USER.activeLocationName,
    isActive:
      typeof input.isActive === "boolean" ? input.isActive : DEFAULT_USER.isActive,
  };
}

function readStoredCurrentUser(): AppUser | null {
  if (!canUseBrowserStorage()) return null;

  try {
    const raw = localStorage.getItem(MOCK_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AppUser>;
    return normalizeUser(parsed);
  } catch {
    return null;
  }
}

function saveStoredCurrentUser(user: AppUser) {
  if (!canUseBrowserStorage()) return;
  localStorage.setItem(MOCK_SESSION_STORAGE_KEY, JSON.stringify(user, null, 2));
}

export function getMockUsers(): AppUser[] {
  return MOCK_USERS.map((user) => normalizeUser(user));
}

export function getDefaultCurrentUser(): AppUser {
  return normalizeUser(DEFAULT_USER);
}

export function getCurrentUser(): AppUser {
  return readStoredCurrentUser() ?? getDefaultCurrentUser();
}

export function setCurrentUserById(userId: string): AppUser {
  const selected =
    getMockUsers().find((user) => user.id === normalizeText(userId)) ??
    getDefaultCurrentUser();

  saveStoredCurrentUser(selected);
  return selected;
}

export function updateCurrentUser(
  updates: Partial<AppUser>
): AppUser {
  const current = getCurrentUser();

  const next = normalizeUser({
    ...current,
    ...updates,
    id: current.id,
  });

  saveStoredCurrentUser(next);
  return next;
}

export function clearCurrentUser() {
  if (!canUseBrowserStorage()) return;
  localStorage.removeItem(MOCK_SESSION_STORAGE_KEY);
}

export function setActiveLocationForCurrentUser(
  activeLocationId: string,
  activeLocationName: string
): AppUser {
  return updateCurrentUser({
    activeLocationId,
    activeLocationName,
  });
}

export const CURRENT_USER: AppUser = getDefaultCurrentUser();
