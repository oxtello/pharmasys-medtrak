"use client";

import { useEffect, useMemo, useState } from "react";

type SupportedUserRole =
  | "ADMIN"
  | "PHARMACIST"
  | "TECHNICIAN"
  | "REGISTERED_NURSE"
  | "LICENSED_VOCATIONAL_NURSE"
  | "MEDICAL_ASSISTANT"
  | "PROVIDER";

type UserRole = SupportedUserRole | "NURSE";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  homeLocationId?: string | null;
  homeLocationName?: string | null;
  isActive: boolean;
  createdAt?: string;
};

type LocationOption = {
  id: string;
  name: string;
  code?: string | null;
};

type CreateUserForm = {
  name: string;
  email: string;
  role: SupportedUserRole;
  homeLocationId: string;
  isActive: boolean;
  password: string;
  generateTempPassword: boolean;
};

function roleLabel(role: UserRole) {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "PHARMACIST":
      return "Pharmacist";
    case "TECHNICIAN":
      return "Technician";
    case "REGISTERED_NURSE":
      return "Registered Nurse";
    case "LICENSED_VOCATIONAL_NURSE":
      return "Licensed Vocational Nurse";
    case "MEDICAL_ASSISTANT":
      return "Medical Assistant";
    case "PROVIDER":
      return "Provider";
    case "NURSE":
      return "Nurse (Legacy)";
    default:
      return role;
  }
}

function statusBadgeClasses(isActive: boolean) {
  return isActive
    ? "bg-emerald-100 text-emerald-700"
    : "bg-slate-200 text-slate-700";
}

const ROLE_OPTIONS: Array<{ value: SupportedUserRole; label: string }> = [
  { value: "ADMIN", label: "Admin" },
  { value: "PHARMACIST", label: "Pharmacist" },
  { value: "TECHNICIAN", label: "Technician" },
  { value: "REGISTERED_NURSE", label: "Registered Nurse" },
  {
    value: "LICENSED_VOCATIONAL_NURSE",
    label: "Licensed Vocational Nurse",
  },
  { value: "MEDICAL_ASSISTANT", label: "Medical Assistant" },
  { value: "PROVIDER", label: "Provider" },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [issuedTempPassword, setIssuedTempPassword] = useState<string | null>(
    null
  );
  const [issuedTempPasswordFor, setIssuedTempPasswordFor] = useState<
    string | null
  >(null);

  const [form, setForm] = useState<CreateUserForm>({
    name: "",
    email: "",
    role: "REGISTERED_NURSE",
    homeLocationId: "",
    isActive: true,
    password: "",
    generateTempPassword: true,
  });

  async function loadLocations() {
    try {
      const res = await fetch("/api/locations", { cache: "no-store" });
      const data = await res.json();
      const list = Array.isArray(data.locations)
        ? data.locations
        : Array.isArray(data)
          ? data
          : [];

      setLocations(list);

      if (list.length > 0) {
        setForm((prev) => ({
          ...prev,
          homeLocationId: prev.homeLocationId || list[0].id,
        }));
      }
    } catch (error) {
      console.error("Failed to load locations", error);
    }
  }

  async function loadUsers() {
    setLoading(true);
    setStatusMessage("");

    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load users");
      }

      const nextUsers = Array.isArray(data.users)
        ? data.users.map((user: any) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as UserRole,
            homeLocationId: user.homeLocationId ?? user.homeLocation?.id ?? null,
            homeLocationName:
              user.homeLocationName ?? user.homeLocation?.name ?? null,
            isActive: Boolean(user.isActive),
            createdAt: user.createdAt,
          }))
        : [];

      setUsers(nextUsers);
    } catch (error) {
      console.error("Failed to load users", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to load users"
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLocations();
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return users.filter((user) => {
      const haystack = [
        user.name,
        user.email,
        user.homeLocationName,
        user.role,
        roleLabel(user.role),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchText || haystack.includes(searchText);
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      admins: users.filter((u) => u.role === "ADMIN" && u.isActive).length,
      pharmacists: users.filter((u) => u.role === "PHARMACIST" && u.isActive)
        .length,
      technicians: users.filter((u) => u.role === "TECHNICIAN" && u.isActive)
        .length,
      nurses: users.filter(
        (u) =>
          (u.role === "REGISTERED_NURSE" ||
            u.role === "LICENSED_VOCATIONAL_NURSE" ||
            u.role === "NURSE") &&
          u.isActive
      ).length,
      providers: users.filter((u) => u.role === "PROVIDER" && u.isActive)
        .length,
    };
  }, [users]);

  async function handleAddUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setStatusMessage("");
    setIssuedTempPassword(null);
    setIssuedTempPasswordFor(null);

    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        homeLocationId: form.homeLocationId || null,
        password: form.generateTempPassword ? undefined : form.password,
        generateTempPassword: form.generateTempPassword,
      };

      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create user");
      }

      if (data?.user?.id && form.isActive === false) {
        await fetch(`/api/users/${data.user.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isActive: false }),
        });
      }

      setIssuedTempPassword(data.tempPassword ?? null);
      setIssuedTempPasswordFor(data.user?.email ?? form.email);

      setForm({
        name: "",
        email: "",
        role: "REGISTERED_NURSE",
        homeLocationId: locations[0]?.id || "",
        isActive: true,
        password: "",
        generateTempPassword: true,
      });

      setStatusMessage("User created successfully.");
      await loadUsers();
    } catch (error) {
      console.error("Failed to create user", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to create user"
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(
    id: string,
    payload: Partial<{
      role: SupportedUserRole;
      homeLocationId: string | null;
      isActive: boolean;
    }>
  ) {
    setStatusMessage("");
    setIssuedTempPassword(null);
    setIssuedTempPasswordFor(null);

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update user");
      }

      setStatusMessage("User updated successfully.");
      await loadUsers();
    } catch (error) {
      console.error("Failed to update user", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to update user"
      );
    }
  }

  async function resetUserTempPassword(id: string, email: string) {
    setStatusMessage("");
    setIssuedTempPassword(null);
    setIssuedTempPasswordFor(null);

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ generateTempPassword: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to reset temporary password");
      }

      setIssuedTempPassword(data.tempPassword ?? null);
      setIssuedTempPasswordFor(data.user?.email ?? email);
      setStatusMessage("Temporary password reset successfully.");
      await loadUsers();
    } catch (error) {
      console.error("Failed to reset temporary password", error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Failed to reset temporary password"
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Admin / Users</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              User Management
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage staff access, roles, active status, home locations, and
              temporary passwords.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Active" value={stats.active} />
            <StatCard label="Admins" value={stats.admins} />
            <StatCard label="Pharmacists" value={stats.pharmacists} />
            <StatCard label="Techs" value={stats.technicians} />
            <StatCard label="Nurses" value={stats.nurses} />
          </div>
        </div>
      </div>

      {statusMessage ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {statusMessage}
        </div>
      ) : null}

      {issuedTempPassword ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-slate-900">
          <div className="font-semibold">Temporary password generated</div>
          <div className="mt-1">
            User: <span className="font-medium">{issuedTempPasswordFor}</span>
          </div>
          <div className="mt-1">
            Temp password:{" "}
            <span className="font-mono font-semibold">
              {issuedTempPassword}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600">
            Save this now. It will only be shown once.
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Add User</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create a staff account with either a manual password or a generated
            temporary password.
          </p>

          <form onSubmit={handleAddUser} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Jane Smith"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="jane.smith@medtrak.local"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Role
              </label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    role: e.target.value as SupportedUserRole,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Home Location
              </label>
              <select
                value={form.homeLocationId}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    homeLocationId: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              >
                <option value="">No home location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                    {location.code ? ` (${location.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.generateTempPassword}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    generateTempPassword: e.target.checked,
                    password: e.target.checked ? "" : prev.password,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Generate temporary password
            </label>

            {!form.generateTempPassword ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Manual Password
                </label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder="Enter password"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
                />
              </div>
            ) : null}

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Set user as active
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save User"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Current Users
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Update roles, home locations, active status, and reset temporary
                passwords.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              />

              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(e.target.value as "ALL" | UserRole)
                }
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">Admin</option>
                <option value="PHARMACIST">Pharmacist</option>
                <option value="TECHNICIAN">Technician</option>
                <option value="REGISTERED_NURSE">Registered Nurse</option>
                <option value="LICENSED_VOCATIONAL_NURSE">
                  Licensed Vocational Nurse
                </option>
                <option value="MEDICAL_ASSISTANT">Medical Assistant</option>
                <option value="PROVIDER">Provider</option>
                <option value="NURSE">Nurse (Legacy)</option>
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Home Location</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-10 text-center text-sm text-slate-500"
                    >
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.map((user) => (
                  <tr key={user.id} className="rounded-2xl bg-slate-50">
                    <td className="rounded-l-2xl px-3 py-3">
                      <div className="font-medium text-slate-900">
                        {user.name}
                      </div>
                      <div className="text-sm text-slate-600">{user.email}</div>
                      <div className="text-xs text-slate-500">{user.id}</div>
                    </td>

                    <td className="px-3 py-3">
                      {user.role === "NURSE" ? (
                        <div className="space-y-2">
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            Legacy role detected. Reassign to a supported nurse
                            role.
                          </div>
                          <select
                            value="REGISTERED_NURSE"
                            onChange={(e) =>
                              updateUser(user.id, {
                                role: e.target.value as SupportedUserRole,
                              })
                            }
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          >
                            <option value="REGISTERED_NURSE">
                              Registered Nurse
                            </option>
                            <option value="LICENSED_VOCATIONAL_NURSE">
                              Licensed Vocational Nurse
                            </option>
                          </select>
                        </div>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) =>
                            updateUser(user.id, {
                              role: e.target.value as SupportedUserRole,
                            })
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <select
                        value={user.homeLocationId || ""}
                        onChange={(e) =>
                          updateUser(user.id, {
                            homeLocationId: e.target.value || null,
                          })
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">No home location</option>
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                            {location.code ? ` (${location.code})` : ""}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClasses(
                          user.isActive
                        )}`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="rounded-r-2xl px-3 py-3">
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateUser(user.id, { isActive: !user.isActive })
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            resetUserTempPassword(user.id, user.email)
                          }
                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
                        >
                          Reset Temp Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && filteredUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-10 text-center text-sm text-slate-500"
                    >
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-slate-50 px-4 py-3 text-center">
      <div className="text-xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}
