"use client";

import { useEffect, useState } from "react";

type LedgerIssue = {
  transactionId: string;
  issue: string;
  expected?: string | null;
  actual?: string | null;
};

type LedgerVerifyResponse = {
  success?: boolean;
  verified?: boolean;
  transactionCount?: number;
  issueCount?: number;
  chainHeadHash?: string | null;
  lastTransactionId?: string | null;
  lastOccurredAt?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: {
    id: string;
    email: string;
    role: string;
  } | null;
  issues?: LedgerIssue[];
  error?: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function LedgerIntegrityReportPage() {
  const [data, setData] = useState<LedgerVerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [backfilling, setBackfilling] = useState(false);

  async function loadReport() {
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/inventory/ledger/verify", {
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

  async function runBackfill() {
    setBackfilling(true);
    setActionMessage("");
    setErrorMessage("");

    try {
      const res = await fetch("/api/inventory/ledger/backfill", {
        method: "POST",
      });

      const body = await res.json();

      if (!res.ok) {
        setErrorMessage(body.error || "Failed to backfill ledger");
        return;
      }

      setActionMessage(
        `Ledger backfill complete. Updated ${body.updatedCount ?? 0} of ${body.transactionCount ?? 0} transactions.`
      );

      await loadReport();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to backfill ledger");
    } finally {
      setBackfilling(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, []);

  const verified = !!data?.verified;
  const issues = data?.issues ?? [];

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

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadReport}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Refresh Verification
            </button>
            <button
              type="button"
              onClick={runBackfill}
              disabled={backfilling}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {backfilling ? "Backfilling..." : "Backfill Ledger"}
            </button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {actionMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {actionMessage}
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
            {loading ? "-" : data?.transactionCount ?? 0}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Issues Found</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {loading ? "-" : data?.issueCount ?? 0}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Verified By</div>
          <div className="mt-2 text-sm font-medium text-slate-900">
            {loading
              ? "Loading..."
              : data?.verifiedBy
              ? `${data.verifiedBy.email} (${data.verifiedBy.role})`
              : "Current authorized user"}
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
            One or more ledger integrity issues were detected. Review the details
            below.
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Verified At
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900">
              {loading ? "—" : formatDateTime(data?.verifiedAt)}
            </div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Last Transaction ID
            </div>
            <div className="mt-2 break-all text-sm font-medium text-slate-900">
              {loading ? "—" : data?.lastTransactionId || "—"}
            </div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Last Occurred At
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900">
              {loading ? "—" : formatDateTime(data?.lastOccurredAt)}
            </div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Chain Head Hash
            </div>
            <div className="mt-2 break-all text-xs font-medium text-slate-900">
              {loading ? "—" : data?.chainHeadHash || "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Issue Details</h2>
          <p className="mt-1 text-sm text-slate-500">
            Displays any transaction-level hash or chain-link mismatches.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Loading issues...</div>
        ) : issues.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No issues detected.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="border-b px-4 py-3 text-left font-medium text-slate-600">
                    Transaction ID
                  </th>
                  <th className="border-b px-4 py-3 text-left font-medium text-slate-600">
                    Issue
                  </th>
                  <th className="border-b px-4 py-3 text-left font-medium text-slate-600">
                    Expected
                  </th>
                  <th className="border-b px-4 py-3 text-left font-medium text-slate-600">
                    Actual
                  </th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={`${issue.transactionId}-${issue.issue}`} className="border-t">
                    <td className="px-4 py-3 align-top font-mono text-xs text-slate-700">
                      {issue.transactionId}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-900">
                      {issue.issue}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-xs text-slate-600">
                      {issue.expected || "—"}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-xs text-slate-600">
                      {issue.actual || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
