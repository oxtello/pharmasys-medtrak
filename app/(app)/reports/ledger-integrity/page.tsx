"use client";

import { useEffect, useState } from "react";

type LedgerVerifyResponse = {
  verified: boolean;
  checkedRecords: number;
  brokenAtTransactionId?: string | null;
  firstBrokenIndex?: number | null;
  expectedPreviousHash?: string | null;
  actualPreviousHash?: string | null;
  expectedHash?: string | null;
  actualHash?: string | null;
  error?: string;
};

export default function LedgerIntegrityReportPage() {
  const [data, setData] = useState<LedgerVerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadReport() {
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/reports/ledger-integrity", {
        cache: "no-store",
      });

      const body = await res.json();

      if (!res.ok) {
        setData(null);
        setErrorMessage(body.error || "Failed to load ledger integrity report");
        return;
      }

      setData(body);
    } catch (error) {
      console.error(error);
      setData(null);
      setErrorMessage("Failed to load ledger integrity report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, []);

  const verified = !!data?.verified;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Ledger Integrity
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Validate the tamper-evident medication ledger hash chain.
            </p>
          </div>

          <button
            type="button"
            onClick={loadReport}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
          >
            Refresh Verification
          </button>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Ledger Status</div>
          <div
            className={`mt-2 text-2xl font-semibold ${
              verified ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {loading ? "Checking..." : verified ? "Verified" : "Attention Required"}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Transactions Checked</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {loading ? "-" : data?.checkedRecords ?? 0}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Broken Transaction</div>
          <div className="mt-2 break-all text-sm font-medium text-slate-900">
            {loading ? "—" : data?.brokenAtTransactionId || "None"}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Broken Index</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {loading ? "-" : data?.firstBrokenIndex ?? "—"}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Verification Summary
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            This report confirms whether each transaction hash and previous-hash
            link matches the expected chronological ledger chain.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Running ledger verification...
          </div>
        ) : verified ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Ledger integrity verified successfully. No hash-chain mismatches were found.
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            A ledger integrity issue was detected. Review the mismatch details below.
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Expected Previous Hash
            </div>
            <div className="mt-2 break-all font-mono text-xs text-slate-900">
              {loading ? "—" : data?.expectedPreviousHash || "—"}
            </div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Actual Previous Hash
            </div>
            <div className="mt-2 break-all font-mono text-xs text-slate-900">
              {loading ? "—" : data?.actualPreviousHash || "—"}
            </div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Expected Hash
            </div>
            <div className="mt-2 break-all font-mono text-xs text-slate-900">
              {loading ? "—" : data?.expectedHash || "—"}
            </div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Actual Hash
            </div>
            <div className="mt-2 break-all font-mono text-xs text-slate-900">
              {loading ? "—" : data?.actualHash || "—"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
