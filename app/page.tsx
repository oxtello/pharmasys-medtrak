"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function HomePage() {
  const [email, setEmail] = useState("admin@medtrak.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/inventory",
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    window.location.href = "/inventory";
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/Logo_Transparent.png"
              alt="MedTrak"
              width={160}
              height={48}
              priority
              className="h-10 w-auto"
            />
          </div>
          <div className="text-sm text-slate-500">
            Medication inventory and compliance tracking
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-73px)] max-w-7xl items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              Launch build
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Secure medication inventory control for modern clinics
            </h1>

            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Track receiving, dispensing, transfer, waste, disposal, cycle
              counts, reconciliation, and compliance reporting in one place.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">
                  Barcode-driven workflows
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Faster entry with standardized medication mapping.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">
                  Role-based controls
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Restrict high-risk actions by authenticated role.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">
                  Audit-ready records
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Preserve transaction history for review and reporting.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">
                  Clinic-friendly design
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Clean, simple workflows built for real medication handling.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-slate-900">
                  Sign in to MedTrak
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Use a test account below to continue.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="admin@medtrak.local"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Test accounts
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div>
                    <span className="font-medium text-slate-900">Admin:</span>{" "}
                    admin@medtrak.local / admin123
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">
                      Pharmacist:
                    </span>{" "}
                    pharm@medtrak.local / pharm123
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">
                      Technician:
                    </span>{" "}
                    tech@medtrak.local / tech123
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
