"use client";

import { useEffect, useMemo, useState } from "react";

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

type ReconciliationRow = {
  id: string;
  occurredAt?: string;
  medicationName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  locationName?: string | null;
  barcode?: string | null;
  expectedCount?: number | string | null;
  actualCount?: number | string | null;
  variance?: number | string | null;
  comment?: string | null;
  countedBy?: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatNumber(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

export default function CompliancePacketPage() {
  const [ledger, setLedger] = useState<LedgerVerifyResponse | null>(null);
  const [reconciliationRows, setReconciliationRows] = useState<ReconciliationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadPacket() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [ledgerRes, reconciliationRes] = await Promise.all([
        fetch("/api/inventory/ledger/verify", { cache: "no-store" }),
        fetch("/api/reports/reconciliation", { cache: "no-store" }),
      ]);

      const ledgerBody = await ledgerRes.json();
      const reconciliationBody = await reconciliationRes.json();

      if (!ledgerRes.ok) {
        setErrorMessage(ledgerBody.error || "Failed to load compliance packet");
        setLedger(null);
        setReconciliationRows([]);
        return;
      }

      if (!reconciliationRes.ok) {
        setErrorMessage(
          reconciliationBody.error || "Failed to load compliance packet"
        );
        setLedger(ledgerBody);
        setReconciliationRows([]);
        return;
      }

      setLedger(ledgerBody);
      setReconciliationRows(reconciliationBody.reconciliations ?? []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load compliance packet");
      setLedger(null);
      setReconciliationRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPacket();
  }, []);

  const summary = useMemo(() => {
    const total = reconciliationRows.length;
    const withVariance = reconciliationRows.filter(
      (row) => formatNumber(row.variance) !== 0
    ).length;

    const unresolvedVarianceComments = reconciliationRows.filter((row) => {
      const variance = formatNumber(row.variance);
      return variance !== 0 && !String(row.comment ?? "").trim();
    }).length;

    return {
      total,
      withVariance,
      unresolvedVarianceComments,
    };
  }, [reconciliationRows]);

  const recentRows = useMemo(() => reconciliationRows.slice(0, 25), [reconciliationRows]);

  return (
    <div className="space-y-8 print:space-y-4">
      <style jsx global>{`
        @media print {
          @page {
            size: portrait;
            margin: 0.5in;
          }

          body {
            background: white !important;
          }

          .print-hide {
            display: none !important;
          }

          .print-break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-text-black,
          .print-text-black * {
            color: black !important;
          }

          .print-border-black {
            border-color: #000 !important;
          }

          .print-bg-white {
            background: white !important;
          }

          table {
            width: 100% !important;
          }

          th,
          td {
            font-size: 11px !important;
          }
        }
      `}</style>

      <section className="rounded-2xl border bg-white p-6 shadow-sm print-break-inside-avoid print-border-black print-bg-white print:rounded-none print:shadow-none">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 print-text-black">
              MedTrak
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 print-text-black">
              Compliance Packet
            </h1>
            <p className="mt-1 text-sm text-slate-500 print-text-black">
              Audit-ready summary of reconciliation activity and ledger integrity.
            </p>
          </div>

          <div className="print-hide">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Print / Save PDF
            </button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 print-border-black print-bg-white print-text-black">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
        <div className="rounded-2xl border bg-white p-6 shadow-sm print-break-inside-avoid print-border-black print-bg-white print:rounded-none print:shadow-none">
          <div className="text-sm text-slate-500 print-text-black">Ledger Status</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 print-text-black">
            {loading ? "Loading..." : ledger?.verified ? "Verified" : "Attention Required"}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm print-break-inside-avoid print-border-black print-bg-white print:rounded-none print:shadow-none">
          <div className="text-sm text-slate-500 print-text-black">Transactions Checked</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 print-text-black">
            {loading ? "-" : ledger?.transactionCount ?? 0}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm print-break-inside-avoid print-border-black print-bg-white print:rounded-none print:shadow-none">
          <div className="text-sm text-slate-500 print-text-black">Cycle Counts Reviewed</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 print-text-black">
            {loading ? "-" : summary.total}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm print-break-inside-avoid print-border-black print-bg-white print:rounded-none print:shadow-none">
          <div className="text-sm text-slate-500 print-text-black">Counts With Variance</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 print-text-black">
            {loading ? "-" : summary.withVariance}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm print-break-inside-avoid print-border-black print-bg-white print:rounded-none print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900 print-text-black">
          Ledger Verification
        </h2>
        <p className="mt-1 text-sm text-slate-500 print-text-black">
          Confirms whether the tamper-evident transaction chain is intact.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
          <div className="rounded-xl border bg-slate-50 p-4 print-border-black print-bg-white">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 print-text-black">
              Verified At
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900 print-text-black">
              {loading ? "—" : formatDateTime(ledger?.verifiedAt)}
            </div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4 print-border-black print-bg-white">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 print-text-black">
              Verified By
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900 print-text-black">
              {loading
                ? "—"
                : ledger?.verifiedBy
                ? `${ledger.verifiedBy.email} (${ledger.verifiedBy.role})`
                : "—"}
            </div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4 print-border-black print-bg-white">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 print-text-black">
              Issue Count
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900 print-text-black">
              {loading ? "—" : ledger?.issueCount ?? 0}
            </div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4 print-border-black print-bg-white">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 print-text-black">
              Chain Head Hash
            </div>
            <div className="mt-2 break-all text-xs font-medium text-slate-900 print-text-black">
              {loading ? "—" : ledger?.chainHeadHash || "—"}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 print-border-black print-bg-white print-text-black">
          {loading
            ? "Running verification..."
            : ledger?.verified
            ? "The ledger verification completed successfully with no detected hash-chain mismatches."
            : "The ledger verification detected one or more integrity issues. Review the Ledger Integrity report for transaction-level detail."}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm print-break-inside-avoid print-border-black print-bg-white print:rounded-none print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900 print-text-black">
          Reconciliation Summary
        </h2>
        <p className="mt-1 text-sm text-slate-500 print-text-black">
          Snapshot of recent cycle count reconciliation activity.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3 print:grid-cols-3">
          <div className="rounded-xl border bg-slate-50 p-4 print-border-black print-bg-white">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 print-text-black">
              Total Cycle Counts
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900 print-text-black">
              {loading ? "—" : summary.total}
            </div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4 print-border-black print-bg-white">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 print-text-black">
              Counts With Variance
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900 print-text-black">
              {loading ? "—" : summary.withVariance}
            </div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4 print-border-black print-bg-white">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 print-text-black">
              Missing Variance Comments
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900 print-text-black">
              {loading ? "—" : summary.unresolvedVarianceComments}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm print-border-black print-bg-white print:rounded-none print:shadow-none">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 print-text-black">
              Recent Reconciliation Detail
            </h2>
            <p className="mt-1 text-sm text-slate-500 print-text-black">
              Most recent 25 cycle count records included in this packet.
            </p>
          </div>
          <div className="text-xs text-slate-500 print-text-black">
            {loading ? "" : `${recentRows.length} row(s) shown`}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="border-b px-4 py-3 text-left font-medium text-slate-600 print-border-black print-text-black">
                  Date
                </th>
                <th className="border-b px-4 py-3 text-left font-medium text-slate-600 print-border-black print-text-black">
                  Medication
                </th>
                <th className="border-b px-4 py-3 text-left font-medium text-slate-600 print-border-black print-text-black">
                  Location
                </th>
                <th className="border-b px-4 py-3 text-left font-medium text-slate-600 print-border-black print-text-black">
                  Expected
                </th>
                <th className="border-b px-4 py-3 text-left font-medium text-slate-600 print-border-black print-text-black">
                  Actual
                </th>
                <th className="border-b px-4 py-3 text-left font-medium text-slate-600 print-border-black print-text-black">
                  Variance
                </th>
                <th className="border-b px-4 py-3 text-left font-medium text-slate-600 print-border-black print-text-black">
                  Comment
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-slate-500 print-text-black"
                  >
                    Loading compliance packet...
                  </td>
                </tr>
              ) : recentRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-slate-500 print-text-black"
                  >
                    No reconciliation records found.
                  </td>
                </tr>
              ) : (
                recentRows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3 align-top text-slate-700 print-text-black">
                      {formatDateTime(row.occurredAt)}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-900 print-text-black">
                      <div className="font-medium">
                        {row.medicationName || "Unknown medication"}
                      </div>
                      <div className="text-xs">
                        {[row.strength, row.dosageForm].filter(Boolean).join(" • ") || "—"}
                      </div>
                      <div className="text-xs">
                        Barcode: {row.barcode || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700 print-text-black">
                      {row.locationName || "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700 print-text-black">
                      {formatNumber(row.expectedCount)}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700 print-text-black">
                      {formatNumber(row.actualCount)}
                    </td>
                    <td className="px-4 py-3 align-top font-medium text-slate-900 print-text-black">
                      {formatNumber(row.variance)}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700 print-text-black">
                      {row.comment || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm print-break-inside-avoid print-border-black print-bg-white print:rounded-none print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900 print-text-black">
          Attestation
        </h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <div className="text-sm text-slate-600 print-text-black">
              Prepared By
            </div>
            <div className="mt-10 border-b border-slate-400 print-border-black" />
            <div className="mt-2 text-xs text-slate-500 print-text-black">
              Name / Signature / Date
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-600 print-text-black">
              Reviewed By
            </div>
            <div className="mt-10 border-b border-slate-400 print-border-black" />
            <div className="mt-2 text-xs text-slate-500 print-text-black">
              Name / Signature / Date
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
