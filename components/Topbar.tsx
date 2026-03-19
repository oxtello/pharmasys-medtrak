"use client";

import { signOut, useSession } from "next-auth/react";

export default function Topbar() {
  const { data: session } = useSession();

  const initials = (
    session?.user?.name
      ?.split(" ")
      .map((part) => part[0])
      .join("") ?? "U"
  )
    .slice(0, 2)
    .toUpperCase();

  const role = ((session?.user as any)?.role ?? "staff").toString();

  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">MedTrak</h1>
        <p className="text-sm text-slate-500">
          Medication inventory and compliance tracking
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
          {initials}
        </div>

        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">
            {session?.user?.name ?? "User"}
          </p>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {role}
          </p>
        </div>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
