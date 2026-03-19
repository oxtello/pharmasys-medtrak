"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AlertSeverity = "LOW" | "MEDIUM" | "HIGH";
type AlertCategory =
  | "HIGH_WASTE"
  | "AFTER_HOURS_CONTROLLED"
  | "FREQUENT_ADJUSTMENTS"
  | "REPEATED_VARIANCE";

type DiversionAlert = {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  detail: string;
  medicationName?: string | null;
  deaSchedule?: string | null;
  locationName?: string | null;
  actorName?: string | null;
  eventCount: number;
  lastOccurredAt?: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function severityClasses(severity: AlertSeverity) {
  if (severity === "HIGH") return "border-rose-200 bg-rose-50 text-rose-700";
  if (severity === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function categoryLabel(category: AlertCategory) {
  switch (category) {
    case "HIGH_WASTE":
      return "High Waste";
    case "AFTER_HOURS_CONTROLLED":
      return "After-hours Controlled Activity";
    case "FREQUENT_ADJUSTMENTS":
      return "Frequent Adjustments";
    case "REPEATED_VARIANCE":
      return "Repeated Variance";
    default:
      return category;
  }
}

export default function DiversionAlertsPage() {
  const [rows, setRows] = useState<DiversionAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [days, setDays] = useState("30");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | AlertSeverity>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | AlertCategory>("ALL");

  async function loadAlerts() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("days", days);

      const res = await fetch(`/api/reports/diversion-alerts?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json();
      const nextRows = Array.isArray(data.alerts) ? data.alerts : [];
      setRows(nextRows);
    } catch (error) {
      console.error("Failed to load diversion alerts", error);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, [days]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSeverity =
        severityFilter === "ALL" || row.severity === severityFilter;
      const matchesCategory =
        categoryFilter === "ALL" || row.category === categoryFilter;

      return matchesSeverity && matchesCategory;
    });
  }, [rows, severityFilter, categoryFilter]);

  const summary = useMemo(() => {
    return {
      total: filteredRows.length,
      high: filteredRows.filter((row) => row.severity === "HIGH").length,
      medium: filteredRows.filter((row) => row.severity === "MEDIUM").length,
      low: filteredRows.filter((row) => row.severity === "LOW").length,
    };
  }, [filteredRows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Diversion Alerts</h1>
          <p className="text-sm text-slate-600">
            Monitor high-risk inventory patterns and activity that may require review.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/reports/diversion-control"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Back
          </Link>
          <button
            onClick={loadAlerts}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            {isLoading ? "Refreshing..." : "Refresh Alerts"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as "ALL" | AlertSeverity)}
            className="rounded border px-3 py-2"
          >
            <option value="ALL">All Severities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "ALL" | AlertCategory)}
            className="rounded border px-3 py-2"
          >
            <option value="ALL">All Categories</option>
            <option value="HIGH_WASTE">High Waste</option>
            <option value="AFTER_HOURS_CONTROLLED">After-hours Controlled Activity</option>
            <option value="FREQUENT_ADJUSTMENTS">Frequent Adjustments</option>
            <option value="REPEATED_VARIANCE">Repeated Variance</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Alerts</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">High Severity</p>
          <p className="mt-2 text-3xl font-semibold text-rose-600">{summary.high}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Medium Severity</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600">{summary.medium}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Low Severity</p>
          <p className="mt-2 text-3xl font-semibold text-slate-700">{summary.low}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredRows.map((row) => (
          <div
            key={row.id}
            className={`rounded-2xl border p-5 shadow-sm ${severityClasses(row.severity)}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border px-2 py-1 text-xs font-semibold">
                    {row.severity}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide">
                    {categoryLabel(row.category)}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold">{row.title}</h2>
                <p className="mt-2 text-sm">{row.detail}</p>
              </div>

              <div className="min-w-56 space-y-1 text-sm">
                <p><span className="font-medium">Medication:</span> {row.medicationName || "-"}</p>
                <p><span className="font-medium">DEA:</span> {row.deaSchedule || "-"}</p>
                <p><span className="font-medium">Location:</span> {row.locationName || "-"}</p>
                <p><span className="font-medium">User:</span> {row.actorName || "-"}</p>
                <p><span className="font-medium">Event Count:</span> {row.eventCount}</p>
                <p><span className="font-medium">Last Occurred:</span> {formatDateTime(row.lastOccurredAt)}</p>
              </div>
            </div>
          </div>
        ))}

        {filteredRows.length === 0 && (
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-500 shadow-sm">
            No diversion alerts found for the selected filters.
          </div>
        )}
      </div>
    </div>
  );
}
