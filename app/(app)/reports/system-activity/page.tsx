"use client";

import { useEffect, useMemo, useState } from "react";

type AuditEventRow = {
  id: string;
  occurredAt: string;
  category: string;
  action: string;
  actorName?: string | null;
  locationName?: string | null;
  medicationName?: string | null;
  details?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  inventoryTransactionId?: string | null;
  reconciliationReportId?: string | null;
  metadataJson?: string | null;
};

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function normalizeCategory(category?: string | null) {
  return String(category || "").trim().toUpperCase();
}

function categoryLabel(category?: string | null) {
  const normalized = normalizeCategory(category);

  switch (normalized) {
    case "INVENTORY":
      return "Inventory";
    case "CONTROLLED_SUBSTANCE":
      return "Controlled Substance";
    case "RECONCILIATION":
      return "Reconciliation";
    case "REPORTING":
      return "Reporting";
    default:
      return category || "-";
  }
}

function getCategoryBadgeClasses(category?: string | null) {
  const normalized = normalizeCategory(category);

  if (normalized === "INVENTORY") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (normalized === "CONTROLLED_SUBSTANCE") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (normalized === "RECONCILIATION") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "REPORTING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getActionBadgeClasses(action?: string | null) {
  const normalized = String(action || "").toUpperCase();

  if (
    normalized.includes("WASTE") ||
    normalized.includes("DISPOSE") ||
    normalized.includes("ADJUST")
  ) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (
    normalized.includes("RECEIVE") ||
    normalized.includes("TRANSFER") ||
    normalized.includes("DISPENSE") ||
    normalized.includes("CYCLE_COUNT")
  ) {
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  }

  if (normalized.includes("RECONCILIATION")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized.includes("EXPORT") || normalized.includes("REPORT")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function splitDetail(detail?: string | null) {
  if (!detail) return [];
  return detail
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function getPrimaryDetail(detail?: string | null) {
  const parts = splitDetail(detail);
  return parts[0] || "-";
}

function getSecondaryDetails(detail?: string | null) {
  const parts = splitDetail(detail);
  return parts.slice(1);
}

export default function SystemActivityPage() {
  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    async function loadActivity() {
      setLoading(true);
      setStatusMessage("");

      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (categoryFilter && categoryFilter !== "ALL") {
          params.set("category", categoryFilter);
        }

        const queryString = params.toString();
        const res = await fetch(
          `/api/reports/system-activity${queryString ? `?${queryString}` : ""}`,
          { cache: "no-store" }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load system activity");
        }

        const rows = Array.isArray(data.events) ? data.events : [];
        setEvents(rows);
      } catch (error) {
        console.error("Failed to load system activity", error);
        setStatusMessage("Failed to load system activity.");
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }

    loadActivity();
  }, [search, categoryFilter]);

  const summary = useMemo(() => {
    const inventoryCount = events.filter(
      (row) => normalizeCategory(row.category) === "INVENTORY"
    ).length;
    const controlledCount = events.filter(
      (row) => normalizeCategory(row.category) === "CONTROLLED_SUBSTANCE"
    ).length;
    const reconciliationCount = events.filter(
      (row) => normalizeCategory(row.category) === "RECONCILIATION"
    ).length;
    const reportingCount = events.filter(
      (row) => normalizeCategory(row.category) === "REPORTING"
    ).length;

    const highRiskCount = events.filter((row) => {
      const action = String(row.action || "").toUpperCase();
      return (
        action.includes("WASTE") ||
        action.includes("DISPOSE") ||
        action.includes("ADJUST") ||
        action.includes("CYCLE_COUNT")
      );
    }).length;

    return {
      total: events.length,
      inventoryCount,
      controlledCount,
      reconciliationCount,
      reportingCount,
      highRiskCount,
    };
  }, [events]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @page {
          size: landscape;
          margin: 0.5in;
        }

        @media print {
          html,
          body {
            background: white !important;
          }

          body * {
            visibility: hidden;
          }

          .print-shell,
          .print-shell * {
            visibility: visible !important;
          }

          .print-shell {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            box-shadow: none !important;
            border: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .no-print {
            display: none !important;
          }

          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          th,
          td {
            border: 1px solid #cbd5e1 !important;
            font-size: 10px !important;
            vertical-align: top !important;
          }

          thead {
            display: table-header-group;
          }

          tr {
            page-break-inside: avoid;
          }

          .print-badge {
            border: 1px solid #cbd5e1 !important;
            background: white !important;
            color: black !important;
            padding: 2px 6px !important;
            border-radius: 9999px !important;
            display: inline-block !important;
            font-size: 10px !important;
          }
        }
      `}</style>

      <div className="no-print flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">System Activity</h1>
          <p className="text-sm text-slate-600">
            Review backend audit activity across inventory, reconciliation, controlled
            substances, and report actions.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Export PDF
        </button>
      </div>

      {statusMessage ? (
        <div className="no-print rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {statusMessage}
        </div>
      ) : null}

      <div className="no-print grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Events</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.total}</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Inventory Events</p>
          <p className="mt-2 text-3xl font-semibold text-blue-600">
            {summary.inventoryCount}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Controlled Events</p>
          <p className="mt-2 text-3xl font-semibold text-rose-600">
            {summary.controlledCount}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">High-Risk Events</p>
          <p className="mt-2 text-3xl font-semibold text-rose-600">
            {summary.highRiskCount}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Reconciliations</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-600">
            {summary.reconciliationCount}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Report Events</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600">
            {summary.reportingCount}
          </p>
        </div>
      </div>

      <div className="no-print space-y-4 rounded-xl border bg-white p-4">
        <div className="flex flex-wrap gap-4">
          <input
            placeholder="Search user, action, medication, location, details"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[280px] flex-1 rounded border px-3 py-2"
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="ALL">All Categories</option>
            <option value="INVENTORY">Inventory</option>
            <option value="CONTROLLED_SUBSTANCE">Controlled Substance</option>
            <option value="RECONCILIATION">Reconciliation</option>
            <option value="REPORTING">Reporting</option>
          </select>
        </div>
      </div>

      <div className="print-shell rounded-xl border bg-white p-6">
        <div className="mb-4 border-b pb-4">
          <h2 className="text-xl font-semibold text-slate-900">
            MedTrak System Activity Report
          </h2>
          <p className="text-sm text-slate-600">
            Backend audit trail of inventory, reconciliation, controlled-substance,
            and reporting activity.
          </p>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">Timestamp</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-left">Action</th>
                <th className="p-2 text-left">User</th>
                <th className="p-2 text-left">Location</th>
                <th className="p-2 text-left">Medication</th>
                <th className="p-2 text-left">Details</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Loading activity...
                  </td>
                </tr>
              ) : events.length ? (
                events.map((row) => {
                  const secondaryDetails = getSecondaryDetails(row.details);

                  return (
                    <tr key={row.id} className="border-t align-top">
                      <td className="p-2 whitespace-nowrap">
                        {formatDateTime(row.occurredAt)}
                      </td>

                      <td className="p-2">
                        <span
                          className={`print-badge inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getCategoryBadgeClasses(
                            row.category
                          )}`}
                        >
                          {categoryLabel(row.category)}
                        </span>
                      </td>

                      <td className="p-2">
                        <span
                          className={`print-badge inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getActionBadgeClasses(
                            row.action
                          )}`}
                        >
                          {row.action}
                        </span>
                      </td>

                      <td className="p-2">{row.actorName || "Unknown User"}</td>

                      <td className="p-2">{row.locationName || "-"}</td>

                      <td className="p-2">{row.medicationName || "-"}</td>

                      <td className="p-2">
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">
                            {getPrimaryDetail(row.details)}
                          </div>

                          {secondaryDetails.length ? (
                            <div className="space-y-1 text-xs text-slate-600">
                              {secondaryDetails.map((item, index) => (
                                <div key={`${row.id}-${index}`}>{item}</div>
                              ))}
                            </div>
                          ) : null}

                          {(row.entityType || row.entityId) && (
                            <div className="pt-1 text-xs text-slate-400">
                              {row.entityType || "Entity"}
                              {row.entityId ? ` • ${row.entityId}` : ""}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    No activity found for the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
