"use client";

import AdminBackupNotice from "@/components/AdminBackupNotice";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SavedReceiveRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  location: string;
  quantityReceived: string;
  deaSchedule?: string;
  expirationDate?: string;
  receivedAt?: string;
};

type SavedDispenseRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  location: string;
  quantity: string;
  deaSchedule?: string;
  timestamp?: string;
};

type SavedAdjustRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  location: string;
  adjustmentType: "ADD" | "SUBTRACT";
  quantity: string;
  reasonCode?: string;
  notes?: string;
  deaSchedule?: string;
  timestamp?: string;
};

type SavedTransferRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  fromLocation: string;
  toLocation: string;
  quantity: string;
  deaSchedule?: string;
  timestamp?: string;
};

type SavedWasteRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  location: string;
  quantity: string;
  reasonCode?: string;
  notes?: string;
  deaSchedule?: string;
  witnessName?: string;
  timestamp?: string;
};

type SavedDisposeRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  location: string;
  quantity: string;
  reasonCode?: string;
  notes?: string;
  deaSchedule?: string;
  witnessName?: string;
  timestamp?: string;
};

type SavedCycleCountRecord = {
  barcode: string;
  medicationName: string;
  location: string;
  expectedQuantity: string;
  actualQuantity: string;
  variance: string;
  notes?: string;
  deaSchedule?: string;
  countedBy?: string;
  timestamp?: string;
};

type InventorySummaryRow = {
  id: string;
  barcode: string;
  medicationName: string;
  location: string;
  deaSchedule: string;
  onHand: number;
  expirationDate: string;
  status: "Healthy" | "Low" | "Critical";
};

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  type:
    | "RECEIVE"
    | "DISPENSE"
    | "ADJUST"
    | "TRANSFER"
    | "WASTE"
    | "DISPOSE"
    | "CYCLE_COUNT";
};

type OpenCycleCountTask = {
  id: string;
  scheduledFor: string;
  status: string;
  riskScore: number;
  priority: string;
  reasonCodes: string;
  medicationId: string;
  locationId: string;
  medication: {
    name: string;
    strength?: string | null;
    dosageForm?: string | null;
    deaSchedule?: string | null;
  };
  location: {
    name: string;
  };
};

function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function rowKey(barcode: string, location: string) {
  return `${barcode}__${location}`;
}

function inferStatus(qty: number): InventorySummaryRow["status"] {
  if (qty <= 5) return "Critical";
  if (qty <= 20) return "Low";
  return "Healthy";
}

function formatDateTime(value?: string) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function daysUntil(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function statusBadgeClasses(status: InventorySummaryRow["status"]) {
  if (status === "Critical") {
    return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  }
  if (status === "Low") {
    return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
  }
  return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
}

function activityTypeClasses(type: ActivityItem["type"]) {
  switch (type) {
    case "RECEIVE":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "DISPENSE":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    case "ADJUST":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "TRANSFER":
      return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
    case "WASTE":
      return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
    case "DISPOSE":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    case "CYCLE_COUNT":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [openCycleCountTasks, setOpenCycleCountTasks] = useState<
    OpenCycleCountTask[]
  >([]);
  const [cycleCountLoading, setCycleCountLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function loadOpenCycleCountTasks() {
      try {
        setCycleCountLoading(true);

        const res = await fetch("/api/cycle-count-tasks?status=OPEN");
        const json = await res.json();

        if (res.ok) {
          setOpenCycleCountTasks((json.tasks || []).slice(0, 5));
        } else {
          setOpenCycleCountTasks([]);
        }
      } catch (error) {
        console.error("Failed to load open cycle count tasks", error);
        setOpenCycleCountTasks([]);
      } finally {
        setCycleCountLoading(false);
      }
    }

    loadOpenCycleCountTasks();
  }, [mounted]);

  const dashboardData = useMemo(() => {
    if (!mounted) {
      return {
        lowStockCount: 0,
        criticalCount: 0,
        expiringSoonCount: 0,
        todayActivityCount: 0,
        controlledMedicationCount: 0,
        openWitnessCount: 0,
        varianceCount: 0,
        recentActivity: [] as ActivityItem[],
        criticalWatchlist: [] as InventorySummaryRow[],
        expiringWatchlist: [] as InventorySummaryRow[],
      };
    }

    const receives = safeReadJson<SavedReceiveRecord[]>(
      "medtrak-received-stock",
      []
    );
    const dispenses = safeReadJson<SavedDispenseRecord[]>(
      "medtrak-dispense-log",
      []
    );
    const adjusts = safeReadJson<SavedAdjustRecord[]>("medtrak-adjust-log", []);
    const transfers = safeReadJson<SavedTransferRecord[]>(
      "medtrak-transfer-log",
      []
    );
    const waste = safeReadJson<SavedWasteRecord[]>("medtrak-waste-log", []);
    const dispose = safeReadJson<SavedDisposeRecord[]>(
      "medtrak-dispose-log",
      []
    );
    const cycleCounts = safeReadJson<SavedCycleCountRecord[]>(
      "medtrak-cycle-count-log",
      []
    );

    const inventoryMap = new Map<string, InventorySummaryRow>();

    function ensureRow(base: {
      barcode: string;
      medicationName?: string;
      location?: string;
      deaSchedule?: string;
      expirationDate?: string;
    }) {
      const barcode = String(base.barcode || "").trim();
      const location = String(base.location || "Unknown").trim();
      const key = rowKey(barcode, location);

      if (!inventoryMap.has(key)) {
        inventoryMap.set(key, {
          id: key,
          barcode,
          medicationName: String(base.medicationName || "Unknown medication"),
          location,
          deaSchedule: String(base.deaSchedule || "").toUpperCase(),
          onHand: 0,
          expirationDate: String(base.expirationDate || ""),
          status: "Healthy",
        });
      }

      const row = inventoryMap.get(key)!;
      if (!row.medicationName && base.medicationName) {
        row.medicationName = base.medicationName;
      }
      if (!row.deaSchedule && base.deaSchedule) {
        row.deaSchedule = String(base.deaSchedule).toUpperCase();
      }
      if (!row.expirationDate && base.expirationDate) {
        row.expirationDate = base.expirationDate;
      }
      return row;
    }

    receives.forEach((item) => {
      const row = ensureRow(item);
      row.onHand += toNumber(item.quantityReceived);
    });

    dispenses.forEach((item) => {
      const row = ensureRow(item);
      row.onHand -= toNumber(item.quantity);
    });

    adjusts.forEach((item) => {
      const row = ensureRow(item);
      const qty = toNumber(item.quantity);
      row.onHand += item.adjustmentType === "ADD" ? qty : -qty;
    });

    transfers.forEach((item) => {
      const fromRow = ensureRow({
        barcode: item.barcode,
        medicationName: item.medicationName,
        location: item.fromLocation,
        deaSchedule: item.deaSchedule,
      });
      fromRow.onHand -= toNumber(item.quantity);

      const toRow = ensureRow({
        barcode: item.barcode,
        medicationName: item.medicationName,
        location: item.toLocation,
        deaSchedule: item.deaSchedule,
      });
      toRow.onHand += toNumber(item.quantity);
    });

    waste.forEach((item) => {
      const row = ensureRow(item);
      row.onHand -= toNumber(item.quantity);
    });

    dispose.forEach((item) => {
      const row = ensureRow(item);
      row.onHand -= toNumber(item.quantity);
    });

    const inventoryRows = Array.from(inventoryMap.values()).map((row) => ({
      ...row,
      onHand: Math.max(0, row.onHand),
      status: inferStatus(Math.max(0, row.onHand)),
    }));

    const lowStockCount = inventoryRows.filter(
      (row) => row.status === "Low"
    ).length;
    const criticalCount = inventoryRows.filter(
      (row) => row.status === "Critical"
    ).length;
    const controlledMedicationCount = inventoryRows.filter((row) =>
      ["C2", "C3", "C4", "C5"].includes(row.deaSchedule)
    ).length;

    const expiringSoonCount = inventoryRows.filter((row) => {
      const days = daysUntil(row.expirationDate);
      return days !== null && days >= 0 && days <= 60;
    }).length;

    const openWitnessCount =
      waste.filter((row) => !String(row.witnessName || "").trim()).length +
      dispose.filter((row) => !String(row.witnessName || "").trim()).length;

    const varianceCount = cycleCounts.filter(
      (row) => Math.abs(toNumber(row.variance)) > 0
    ).length;

    const now = new Date();
    const todayActivityCount = [
      ...receives.map((row) => row.receivedAt || ""),
      ...dispenses.map((row) => row.timestamp || ""),
      ...adjusts.map((row) => row.timestamp || ""),
      ...transfers.map((row) => row.timestamp || ""),
      ...waste.map((row) => row.timestamp || ""),
      ...dispose.map((row) => row.timestamp || ""),
      ...cycleCounts.map((row) => row.timestamp || ""),
    ].filter((value) => {
      if (!value) return false;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      return date.toDateString() === now.toDateString();
    }).length;

    const recentActivity: ActivityItem[] = [
      ...receives.map((row, index) => ({
        id: `receive-${index}`,
        title: row.medicationName || "Medication received",
        detail: `${toNumber(row.quantityReceived)} received into ${row.location}`,
        timestamp: row.receivedAt || "",
        type: "RECEIVE" as const,
      })),
      ...dispenses.map((row, index) => ({
        id: `dispense-${index}`,
        title: row.medicationName || "Medication dispensed",
        detail: `${toNumber(row.quantity)} dispensed from ${row.location}`,
        timestamp: row.timestamp || "",
        type: "DISPENSE" as const,
      })),
      ...adjusts.map((row, index) => ({
        id: `adjust-${index}`,
        title: row.medicationName || "Inventory adjusted",
        detail: `${row.adjustmentType} ${toNumber(row.quantity)} at ${row.location}`,
        timestamp: row.timestamp || "",
        type: "ADJUST" as const,
      })),
      ...transfers.map((row, index) => ({
        id: `transfer-${index}`,
        title: row.medicationName || "Medication transferred",
        detail: `${toNumber(row.quantity)} moved ${row.fromLocation} → ${row.toLocation}`,
        timestamp: row.timestamp || "",
        type: "TRANSFER" as const,
      })),
      ...waste.map((row, index) => ({
        id: `waste-${index}`,
        title: row.medicationName || "Medication wasted",
        detail: `${toNumber(row.quantity)} wasted at ${row.location}`,
        timestamp: row.timestamp || "",
        type: "WASTE" as const,
      })),
      ...dispose.map((row, index) => ({
        id: `dispose-${index}`,
        title: row.medicationName || "Medication disposed",
        detail: `${toNumber(row.quantity)} disposed at ${row.location}`,
        timestamp: row.timestamp || "",
        type: "DISPOSE" as const,
      })),
      ...cycleCounts.map((row, index) => ({
        id: `cycle-${index}`,
        title: row.medicationName || "Cycle count recorded",
        detail: `Variance ${toNumber(row.variance)} at ${row.location}`,
        timestamp: row.timestamp || "",
        type: "CYCLE_COUNT" as const,
      })),
    ]
      .sort((a, b) => {
        const aTime = new Date(a.timestamp || 0).getTime();
        const bTime = new Date(b.timestamp || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 6);

    const criticalWatchlist = [...inventoryRows]
      .filter((row) => row.status === "Critical" || row.status === "Low")
      .sort((a, b) => a.onHand - b.onHand)
      .slice(0, 6);

    const expiringWatchlist = [...inventoryRows]
      .filter((row) => {
        const days = daysUntil(row.expirationDate);
        return days !== null && days >= 0 && days <= 90;
      })
      .sort((a, b) => {
        const aDays = daysUntil(a.expirationDate) ?? 9999;
        const bDays = daysUntil(b.expirationDate) ?? 9999;
        return aDays - bDays;
      })
      .slice(0, 6);

    return {
      lowStockCount,
      criticalCount,
      expiringSoonCount,
      todayActivityCount,
      controlledMedicationCount,
      openWitnessCount,
      varianceCount,
      recentActivity,
      criticalWatchlist,
      expiringWatchlist,
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <AdminBackupNotice />

      <section className="rounded-3xl bg-gradient-to-r from-blue-600 via-blue-700 to-slate-900 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
              Command Dashboard
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Clinical inventory oversight in one place
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-blue-100">
              Monitor low stock, expiring lots, transaction activity,
              reconciliation issues, and controlled-med workflows from a single
              operational dashboard.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/inventory/receive"
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
            >
              Receive Stock
            </Link>
            <Link
              href="/inventory/cycle-count"
              className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15"
            >
              Cycle Count
            </Link>
            <Link
              href="/reports/reconciliation"
              className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15"
            >
              Reconciliation
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Low Stock Alerts</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600">
            {dashboardData.lowStockCount}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Medications below your healthy on-hand threshold.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Critical Inventory
          </p>
          <p className="mt-2 text-3xl font-semibold text-rose-600">
            {dashboardData.criticalCount}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Items requiring immediate replenishment or review.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Expiring Soon</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {dashboardData.expiringSoonCount}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Lots expiring within the next 60 days.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Today&apos;s Activity
          </p>
          <p className="mt-2 text-3xl font-semibold text-blue-700">
            {dashboardData.todayActivityCount}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Inventory transactions recorded today.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr,1fr,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Quick Actions
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Fast access to the most common workflows.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href="/inventory/receive"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Receive Inventory
            </Link>
            <Link
              href="/inventory/dispense"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Dispense Medication
            </Link>
            <Link
              href="/inventory/transfer"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Transfer Between Locations
            </Link>
            <Link
              href="/inventory/waste"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Record Waste
            </Link>
            <Link
              href="/inventory/dispose"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Witnessed Disposal
            </Link>
            <Link
              href="/inventory/cycle-count"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Cycle Count
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            Compliance Snapshot
          </p>
          <p className="mt-1 text-sm text-slate-500">
            High-level operational and audit indicators.
          </p>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Controlled Medications
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {dashboardData.controlledMedicationCount}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Missing Witness Review
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {dashboardData.openWitnessCount}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Count Variances Logged
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {dashboardData.varianceCount}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            Priority Reports
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Review audit and inventory reports quickly.
          </p>

          <div className="mt-5 space-y-3">
            <Link
              href="/reports/transactions"
              className="block rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Transactions / Audit Report
            </Link>
            <Link
              href="/reports/waste-disposal"
              className="block rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Waste & Disposal Report
            </Link>
            <Link
              href="/reports/forecast"
              className="block rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Forecast / Reorder Report
            </Link>
            <Link
              href="/reports/reconciliation"
              className="block rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Controlled Medication Reconciliation
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Open Cycle Count Tasks
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Randomized risk-weighted physical inventory checks ready to
                perform.
              </p>
            </div>
            <Link
              href="/reports/cycle-count-scheduler"
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View All
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {cycleCountLoading ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Loading cycle count tasks...
              </div>
            ) : openCycleCountTasks.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                No open cycle count tasks.
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Tasks Ready
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {openCycleCountTasks.length}
                  </p>
                </div>

                {openCycleCountTasks.map((task) => {
                  const href = `/inventory/cycle-count?taskId=${encodeURIComponent(
                    task.id
                  )}&locationId=${encodeURIComponent(
                    task.locationId
                  )}&search=${encodeURIComponent(task.medication.name)}`;

                  return (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {task.medication.name}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {[
                              task.medication.strength,
                              task.medication.dosageForm,
                              task.medication.deaSchedule,
                              task.location.name,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            Scheduled {formatDateTime(task.scheduledFor)}
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {task.priority}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                          Score {task.riskScore}
                        </span>
                        {String(task.reasonCodes || "")
                          .split(",")
                          .map((reason) => reason.trim())
                          .filter(Boolean)
                          .map((reason) => (
                            <span
                              key={`${task.id}-${reason}`}
                              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
                            >
                              {reason.replaceAll("_", " ")}
                            </span>
                          ))}
                      </div>

                      <div className="mt-4">
                        <Link
                          href={href}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Start Count
                        </Link>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-1">
                  <Link
                    href="/reports/cycle-count-scheduler"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Open cycle count scheduler
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Recent Activity
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Latest ledger activity across inventory workflows.
              </p>
            </div>
            <Link
             href="/reports/transactions"
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View All
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {dashboardData.recentActivity.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                No recent activity yet.
              </div>
            ) : (
              dashboardData.recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.detail}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${activityTypeClasses(
                        item.type
                      )}`}
                    >
                      {item.type.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    {formatDateTime(item.timestamp)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Critical Inventory Watchlist
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Locations needing immediate restock or review.
              </p>
            </div>
            <Link
              href="/inventory"
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Inventory
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {dashboardData.criticalWatchlist.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                No low or critical inventory items right now.
              </div>
            ) : (
              dashboardData.criticalWatchlist.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {row.medicationName}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {row.location} • {row.deaSchedule || "Non-controlled"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-900">
                      {row.onHand}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses(
                        row.status
                      )}`}
                    >
                      {row.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Expiring Lots
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Inventory needing rotation or removal soon.
              </p>
            </div>
            <Link
              href="/reports/expirations"
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Expirations
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {dashboardData.expiringWatchlist.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                No expiring lots within 90 days.
              </div>
            ) : (
              dashboardData.expiringWatchlist.map((row) => {
                const days = daysUntil(row.expirationDate);

                return (
                  <div
                    key={`${row.id}-exp`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {row.medicationName}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {row.location} • Exp {formatDate(row.expirationDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {days ?? "—"} days
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        On hand: {row.onHand}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
