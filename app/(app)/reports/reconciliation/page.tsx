"use client";

import { useEffect, useMemo, useState } from "react";

type Location = {
  id: string;
  name: string;
};

type Row = {
  medicationId: string;
  medicationName: string;
  strength?: string | null;
  dosageForm?: string | null;
  deaSchedule?: string | null;
  locationId: string;
  locationName: string;

  beginningBalance: number;
  receipts: number;
  transfersIn: number;
  dispensed: number;
  waste: number;
  dispose: number;
  transfersOut: number;
  adjustments: number;

  expectedEndingBalance: number;
  physicalCount: number | null;
  variance: number | null;

  countedBy?: string | null;
  notes?: string | null;
};

type DraftEntry = {
  physicalCount: string;
  notes: string;
};

type SavedReconciliation = {
  finalized: boolean;
  finalizedAt: string;
  reviewerRole: string;
  reviewerName: string;
  reviewTiming: string;
  locationId: string;
  locationName: string;
  startDate: string;
  endDate: string;
  search: string;
  deaSchedules: string[];
  discrepancyOnly: boolean;
  reportId?: string;
  rows: Array<{
    medicationId: string;
    medicationName: string;
    strength?: string | null;
    dosageForm?: string | null;
    deaSchedule?: string | null;
    locationId: string;
    locationName: string;
    beginningBalance: number;
    receipts: number;
    transfersIn: number;
    dispensed: number;
    waste: number;
    dispose: number;
    transfersOut: number;
    adjustments: number;
    expectedEndingBalance: number;
    physicalCount: number | null;
    variance: number | null;
    notes?: string | null;
    status: string;
  }>;
};

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/\.?0+$/, "");
}

function toNumber(value: string) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function rowKey(row: { medicationId: string; locationId: string }) {
  return `${row.medicationId}__${row.locationId}`;
}

function reconciliationStorageKey(locationId: string, startDate: string, endDate: string) {
  return `medtrak-reconciliation-finalized:${locationId || "all"}:${startDate || "na"}:${endDate || "na"}`;
}

export default function ReconciliationPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [discrepancyOnly, setDiscrepancyOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [reviewTiming, setReviewTiming] = useState("BOD");
  const [reviewerRole, setReviewerRole] = useState("Pharmacist Consultant");
  const [reviewerName, setReviewerName] = useState("");
  const [deaSchedules, setDeaSchedules] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftEntry>>({});
  const [finalized, setFinalized] = useState(false);
  const [finalizedAt, setFinalizedAt] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  function toggleSchedule(schedule: string) {
    if (finalized) return;

    setDeaSchedules((prev) =>
      prev.includes(schedule)
        ? prev.filter((s) => s !== schedule)
        : [...prev, schedule]
    );
  }

  useEffect(() => {
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
          setLocationId((current) => current || list[0].id);
        }
      } catch (error) {
        console.error("Failed to load locations", error);
      }
    }

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    setEndDate(today.toISOString().slice(0, 10));
    setStartDate(thirtyDaysAgo.toISOString().slice(0, 10));

    loadLocations();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!locationId || !startDate || !endDate) return;

    const saved = localStorage.getItem(
      reconciliationStorageKey(locationId, startDate, endDate)
    );

    if (!saved) {
      setFinalized(false);
      setFinalizedAt("");
      setStatusMessage("");
      return;
    }

    try {
      const parsed: SavedReconciliation = JSON.parse(saved);

      setFinalized(Boolean(parsed.finalized));
      setFinalizedAt(parsed.finalizedAt || "");
      setReviewerRole(parsed.reviewerRole || "Pharmacist Consultant");
      setReviewerName(parsed.reviewerName || "");
      setReviewTiming(parsed.reviewTiming || "BOD");
      setSearch(parsed.search || "");
      setDeaSchedules(Array.isArray(parsed.deaSchedules) ? parsed.deaSchedules : []);
      setDiscrepancyOnly(Boolean(parsed.discrepancyOnly));

      const restoredRows: Row[] = Array.isArray(parsed.rows)
        ? parsed.rows.map((row) => ({
            medicationId: row.medicationId,
            medicationName: row.medicationName,
            strength: row.strength || "",
            dosageForm: row.dosageForm || "",
            deaSchedule: row.deaSchedule || "",
            locationId: row.locationId,
            locationName: row.locationName,
            beginningBalance: Number(row.beginningBalance || 0),
            receipts: Number(row.receipts || 0),
            transfersIn: Number(row.transfersIn || 0),
            dispensed: Number(row.dispensed || 0),
            waste: Number(row.waste || 0),
            dispose: Number(row.dispose || 0),
            transfersOut: Number(row.transfersOut || 0),
            adjustments: Number(row.adjustments || 0),
            expectedEndingBalance: Number(row.expectedEndingBalance || 0),
            physicalCount:
              row.physicalCount === null || row.physicalCount === undefined
                ? null
                : Number(row.physicalCount),
            variance:
              row.variance === null || row.variance === undefined
                ? null
                : Number(row.variance),
            notes: row.notes || "",
          }))
        : [];

      setRows(restoredRows);

      const restoredDrafts: Record<string, DraftEntry> = {};
      for (const row of restoredRows) {
        restoredDrafts[rowKey(row)] = {
          physicalCount:
            row.physicalCount === null || row.physicalCount === undefined
              ? ""
              : String(row.physicalCount),
          notes: row.notes || "",
        };
      }
      setDrafts(restoredDrafts);

      setStatusMessage("Loaded finalized reconciliation.");
    } catch (error) {
      console.error("Failed to restore finalized reconciliation", error);
      setFinalized(false);
      setFinalizedAt("");
      setStatusMessage("");
    }
  }, [locationId, startDate, endDate]);

  async function runReconciliation() {
    if (finalized) {
      setStatusMessage("This reconciliation has been finalized and is locked.");
      return;
    }

    setIsLoading(true);
    setStatusMessage("");

    try {
      const params = new URLSearchParams();

      if (locationId) params.set("locationId", locationId);
      if (search.trim()) params.set("search", search.trim());
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (deaSchedules.length) {
        params.set("deaSchedules", deaSchedules.join(","));
      }

      const res = await fetch(`/api/reports/reconciliation?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json();
      const list = Array.isArray(data.rows) ? data.rows : [];
      setRows(list);

      setDrafts((prev) => {
        const next = { ...prev };

        for (const row of list) {
          const key = rowKey(row);
          if (!next[key]) {
            next[key] = {
              physicalCount:
                row.physicalCount === null || row.physicalCount === undefined
                  ? ""
                  : String(row.physicalCount),
              notes: row.notes || "",
            };
          }
        }

        return next;
      });
    } catch (error) {
      console.error("Failed to run reconciliation", error);
      setStatusMessage("Failed to run reconciliation.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateDraft(key: string, field: keyof DraftEntry, value: string) {
    if (finalized) return;

    setDrafts((prev) => ({
      ...prev,
      [key]: {
        physicalCount: prev[key]?.physicalCount ?? "",
        notes: prev[key]?.notes ?? "",
        [field]: value,
      },
    }));
  }

  const rowsWithCounts = useMemo(() => {
    return rows.map((row) => {
      const key = rowKey(row);
      const draft = drafts[key];

      const physicalCount =
        draft && draft.physicalCount.trim() !== ""
          ? toNumber(draft.physicalCount)
          : null;

      const variance =
        physicalCount === null
          ? null
          : physicalCount - Number(row.expectedEndingBalance || 0);

      return {
        ...row,
        physicalCount,
        variance,
        notes: draft?.notes ?? row.notes ?? "",
      };
    });
  }, [rows, drafts]);

  const filteredRows = useMemo(() => {
    if (!discrepancyOnly) return rowsWithCounts;
    return rowsWithCounts.filter((r) => (r.variance ?? 0) !== 0);
  }, [rowsWithCounts, discrepancyOnly]);

  const summary = useMemo(() => {
    const totalRows = filteredRows.length;
    const varianceRows = filteredRows.filter((r) => (r.variance ?? 0) !== 0).length;
    const controlledRows = filteredRows.filter((r) =>
      ["C2", "C3", "C4", "C5"].includes(String(r.deaSchedule || "").toUpperCase())
    ).length;
    const totalExpected = filteredRows.reduce(
      (sum, r) => sum + Number(r.expectedEndingBalance || 0),
      0
    );

    return {
      totalRows,
      varianceRows,
      controlledRows,
      totalExpected,
    };
  }, [filteredRows]);

  function status(row: (typeof filteredRows)[number]) {
    if (row.physicalCount === null) return "Pending Count";
    if ((row.variance ?? 0) === 0) return "Matched";
    return "Variance";
  }

  function selectedLocationName() {
    return locations.find((l) => l.id === locationId)?.name || "All Locations";
  }

  function handlePrintPdf() {
    window.print();
  }

  async function handleFinalize() {
    if (finalized) {
      setStatusMessage("This reconciliation has already been finalized.");
      return;
    }

    if (!reviewerName.trim()) {
      setStatusMessage("Reviewer name is required before finalizing.");
      return;
    }

    if (filteredRows.length === 0) {
      setStatusMessage("Run reconciliation before finalizing.");
      return;
    }

    const pendingCounts = filteredRows.filter((row) => row.physicalCount === null);
    if (pendingCounts.length > 0) {
      setStatusMessage("All rows must have a physical count before finalizing.");
      return;
    }

    setIsFinalizing(true);
    setStatusMessage("");

    try {
      const payload = {
        reviewTiming,
        reviewerRole,
        reviewerName: reviewerName.trim(),
        locationId,
        startDate,
        endDate,
        search,
        deaSchedules,
        discrepancyOnly,
        rows: filteredRows.map((row) => ({
          medicationId: row.medicationId,
          medicationName: row.medicationName,
          strength: row.strength || "",
          dosageForm: row.dosageForm || "",
          deaSchedule: row.deaSchedule || "",
          locationId: row.locationId,
          locationName: row.locationName,
          beginningBalance: Number(row.beginningBalance || 0),
          receipts: Number(row.receipts || 0),
          transfersIn: Number(row.transfersIn || 0),
          dispensed: Number(row.dispensed || 0),
          waste: Number(row.waste || 0),
          dispose: Number(row.dispose || 0),
          transfersOut: Number(row.transfersOut || 0),
          adjustments: Number(row.adjustments || 0),
          expectedEndingBalance: Number(row.expectedEndingBalance || 0),
          physicalCount: row.physicalCount,
          variance: row.variance,
          notes: row.notes || "",
          status: status(row),
        })),
      };

      const res = await fetch("/api/reports/reconciliation/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to finalize reconciliation");
      }

      const finalizedTimestamp = data?.finalizedAt || new Date().toISOString();

      const savedPayload: SavedReconciliation = {
        finalized: true,
        finalizedAt: finalizedTimestamp,
        reviewerRole,
        reviewerName: reviewerName.trim(),
        reviewTiming,
        locationId,
        locationName: selectedLocationName(),
        startDate,
        endDate,
        search,
        deaSchedules,
        discrepancyOnly,
        reportId: data?.reportId,
        rows: filteredRows.map((row) => ({
          medicationId: row.medicationId,
          medicationName: row.medicationName,
          strength: row.strength || "",
          dosageForm: row.dosageForm || "",
          deaSchedule: row.deaSchedule || "",
          locationId: row.locationId,
          locationName: row.locationName,
          beginningBalance: Number(row.beginningBalance || 0),
          receipts: Number(row.receipts || 0),
          transfersIn: Number(row.transfersIn || 0),
          dispensed: Number(row.dispensed || 0),
          waste: Number(row.waste || 0),
          dispose: Number(row.dispose || 0),
          transfersOut: Number(row.transfersOut || 0),
          adjustments: Number(row.adjustments || 0),
          expectedEndingBalance: Number(row.expectedEndingBalance || 0),
          physicalCount: row.physicalCount,
          variance: row.variance,
          notes: row.notes || "",
          status: status(row),
        })),
      };

      if (typeof window !== "undefined") {
        localStorage.setItem(
          reconciliationStorageKey(locationId, startDate, endDate),
          JSON.stringify(savedPayload)
        );
      }

      setFinalized(true);
      setFinalizedAt(finalizedTimestamp);
      setStatusMessage("Reconciliation finalized and locked.");
    } catch (error) {
      console.error("Failed to finalize reconciliation", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to finalize reconciliation."
      );
    } finally {
      setIsFinalizing(false);
    }
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

          .print-page-break-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-input {
            border: 0 !important;
            background: transparent !important;
            padding: 0 !important;
            outline: none !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            box-shadow: none !important;
            resize: none !important;
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

          tr,
          img {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="no-print flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reconciliation</h1>
          <p className="text-sm text-slate-600">
            Complete the physical count within this reconciliation and compare it against
            ledger-derived expected balances.
          </p>
          {finalized ? (
            <div className="mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Finalized{finalizedAt ? ` • ${new Date(finalizedAt).toLocaleString()}` : ""}
            </div>
          ) : (
            <div className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Draft
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleFinalize}
            disabled={finalized || isFinalizing}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {finalized ? "Finalized" : isFinalizing ? "Finalizing..." : "Finalize Report"}
          </button>
          <button
            onClick={handlePrintPdf}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Export PDF
          </button>
        </div>
      </div>

      {finalized ? (
        <div className="no-print rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          This reconciliation has been finalized. Entries are now locked. You may
          still export the report to PDF.
        </div>
      ) : statusMessage ? (
        <div className="no-print rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {statusMessage}
        </div>
      ) : null}

      <div className="no-print space-y-4 rounded-xl border bg-white p-4">
        <div className="flex flex-wrap gap-4">
          <input
            type="date"
            value={startDate}
            onChange={(e) => !finalized && setStartDate(e.target.value)}
            disabled={finalized}
            className="rounded border px-3 py-2 disabled:bg-slate-100"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => !finalized && setEndDate(e.target.value)}
            disabled={finalized}
            className="rounded border px-3 py-2 disabled:bg-slate-100"
          />

          <select
            value={locationId}
            onChange={(e) => !finalized && setLocationId(e.target.value)}
            disabled={finalized}
            className="rounded border px-3 py-2 disabled:bg-slate-100"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <select
            value={reviewTiming}
            onChange={(e) => !finalized && setReviewTiming(e.target.value)}
            disabled={finalized}
            className="rounded border px-3 py-2 disabled:bg-slate-100"
          >
            <option value="BOD">Beginning of Day</option>
            <option value="EOD">End of Day</option>
          </select>

          <input
            placeholder="Search medication"
            value={search}
            onChange={(e) => !finalized && setSearch(e.target.value)}
            disabled={finalized}
            className="rounded border px-3 py-2 disabled:bg-slate-100"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {["C2", "C3", "C4", "C5"].map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={deaSchedules.includes(s)}
                onChange={() => toggleSchedule(s)}
                disabled={finalized}
              />
              {s}
            </label>
          ))}

          <label className="ml-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={discrepancyOnly}
              onChange={() => !finalized && setDiscrepancyOnly(!discrepancyOnly)}
              disabled={finalized}
            />
            Discrepancies Only
          </label>
        </div>

        <div className="flex flex-wrap gap-4">
          <select
            value={reviewerRole}
            onChange={(e) => !finalized && setReviewerRole(e.target.value)}
            disabled={finalized}
            className="rounded border px-3 py-2 disabled:bg-slate-100"
          >
            <option value="Pharmacist Consultant">Pharmacist Consultant</option>
            <option value="Professional Director">Professional Director</option>
            <option value="DEA Registrant">DEA Registrant</option>
            <option value="Other">Other</option>
          </select>

          <input
            placeholder="Reviewer name"
            value={reviewerName}
            onChange={(e) => !finalized && setReviewerName(e.target.value)}
            disabled={finalized}
            className="rounded border px-3 py-2 disabled:bg-slate-100"
          />

          <button
            onClick={runReconciliation}
            disabled={finalized || isLoading || isFinalizing}
            className="rounded bg-slate-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Running..." : "Run Reconciliation"}
          </button>
        </div>
      </div>

      <div className="no-print grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Rows</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalRows}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Variance Rows</p>
          <p className="mt-2 text-3xl font-semibold text-rose-600">{summary.varianceRows}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Controlled Meds</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600">{summary.controlledRows}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Net Expected Units</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {formatNumber(summary.totalExpected)}
          </p>
        </div>
      </div>

      <div
        id="reconciliation-print-root"
        className="print-shell space-y-6 rounded-xl border bg-white p-6"
      >
        <div className="print-page-break-avoid space-y-4">
          <div className="border-b pb-4">
            <h2 className="text-xl font-semibold text-slate-900">
              MedTrak Reconciliation Report
            </h2>
            <p className="text-sm text-slate-600">
              Ledger activity review with physical count completed during reconciliation.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reconciliation Period
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-medium">Start Date:</span> {startDate || "-"}
                </p>
                <p>
                  <span className="font-medium">End Date:</span> {endDate || "-"}
                </p>
                <p>
                  <span className="font-medium">Conducted:</span>{" "}
                  {reviewTiming === "BOD" ? "Beginning of Day" : "End of Day"}
                </p>
                <p>
                  <span className="font-medium">Finalized:</span>{" "}
                  {finalized ? "Yes" : "No"}
                </p>
                <p>
                  <span className="font-medium">Finalized At:</span>{" "}
                  {finalizedAt ? new Date(finalizedAt).toLocaleString() : "-"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Scope
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-medium">Location:</span> {selectedLocationName()}
                </p>
                <p>
                  <span className="font-medium">DEA Schedules:</span>{" "}
                  {deaSchedules.length ? deaSchedules.join(", ") : "All"}
                </p>
                <p>
                  <span className="font-medium">Search Filter:</span> {search || "None"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-auto print-page-break-avoid">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">Medication</th>
                <th className="p-2 text-left">DEA</th>
                <th className="p-2 text-left">Location</th>
                <th className="p-2 text-center">Begin</th>
                <th className="p-2 text-center">Receipts</th>
                <th className="p-2 text-center">Tx In</th>
                <th className="p-2 text-center">Dispensed</th>
                <th className="p-2 text-center">Waste</th>
                <th className="p-2 text-center">Dispose</th>
                <th className="p-2 text-center">Tx Out</th>
                <th className="p-2 text-center">Adjust</th>
                <th className="p-2 text-center">Expected</th>
                <th className="p-2 text-center">Physical Count</th>
                <th className="p-2 text-center">Variance</th>
                <th className="p-2 text-left">Notes</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const key = rowKey(r);
                const draft = drafts[key] || { physicalCount: "", notes: "" };

                return (
                  <tr key={key} className="border-t">
                    <td className="p-2">
                      <div className="font-medium text-slate-900">{r.medicationName}</div>
                      <div className="text-xs text-slate-500">
                        {[r.strength, r.dosageForm].filter(Boolean).join(" • ") || "-"}
                      </div>
                    </td>
                    <td className="p-2 text-left">{r.deaSchedule || "-"}</td>
                    <td className="p-2 text-left">{r.locationName}</td>
                    <td className="p-2 text-center">{formatNumber(r.beginningBalance)}</td>
                    <td className="p-2 text-center">{formatNumber(r.receipts)}</td>
                    <td className="p-2 text-center">{formatNumber(r.transfersIn)}</td>
                    <td className="p-2 text-center">{formatNumber(r.dispensed)}</td>
                    <td className="p-2 text-center">{formatNumber(r.waste)}</td>
                    <td className="p-2 text-center">{formatNumber(r.dispose)}</td>
                    <td className="p-2 text-center">{formatNumber(r.transfersOut)}</td>
                    <td className="p-2 text-center">{formatNumber(r.adjustments)}</td>
                    <td className="p-2 text-center font-medium">
                      {formatNumber(r.expectedEndingBalance)}
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        step="0.001"
                        value={draft.physicalCount}
                        onChange={(e) =>
                          updateDraft(key, "physicalCount", e.target.value)
                        }
                        disabled={finalized}
                        className="print-input w-24 rounded border px-2 py-1 text-right disabled:bg-slate-100"
                        placeholder="Count"
                      />
                    </td>
                    <td
                      className={`p-2 text-center ${
                        (r.variance ?? 0) !== 0 ? "font-semibold text-red-600" : ""
                      }`}
                    >
                      {formatNumber(r.variance)}
                    </td>
                    <td className="p-2">
                      <textarea
                        value={draft.notes}
                        onChange={(e) => updateDraft(key, "notes", e.target.value)}
                        disabled={finalized}
                        className="print-input min-h-16 w-40 rounded border px-2 py-1 disabled:bg-slate-100"
                        placeholder="Variance notes"
                      />
                    </td>
                    <td className="p-2 text-center">{status(r)}</td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={16} className="p-6 text-center text-slate-500">
                    No reconciliation rows found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 md:grid-cols-2 print-page-break-avoid">
          <div className="min-h-32 rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reconciliation Notes
            </p>
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <div className="border-b border-dashed pb-5"></div>
              <div className="border-b border-dashed pb-5"></div>
              <div className="border-b border-dashed pb-5"></div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Certification
            </p>
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <p>
                <span className="font-medium">Reviewed By Role:</span> {reviewerRole}
              </p>
              <p>
                <span className="font-medium">Reviewed By Name:</span>{" "}
                {reviewerName || "______________________________"}
              </p>
              <p>
                <span className="font-medium">Finalized:</span> {finalized ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-medium">Finalized At:</span>{" "}
                {finalizedAt
                  ? new Date(finalizedAt).toLocaleString()
                  : "______________________________"}
              </p>
              <p>
                <span className="font-medium">Signature:</span>{" "}
                ______________________________
              </p>
              <p>
                <span className="font-medium">Date:</span> ______________________________
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
