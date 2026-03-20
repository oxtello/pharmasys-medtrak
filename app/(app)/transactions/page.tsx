"use client";

import { useMemo } from "react";
import { CURRENT_USER } from "@/lib/mock-session";

type SavedReceiveRecord = {
  barcode: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  ndc: string;
  lotNumber: string;
  expirationDate: string;
  location: string;
  quantityReceived: string;
  unit: string;
  supplier?: string;
  notes?: string;
  receivedAt: string;
};

type SavedDispenseRecord = {
  barcode: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  ndc: string;
  patient: string;
  encounterId: string;
  location: string;
  quantity: string;
  notes?: string;
  timestamp: string;
};

type SavedAdjustRecord = {
  barcode: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  ndc: string;
  location: string;
  adjustmentType: "ADD" | "SUBTRACT";
  quantity: string;
  reasonCode: string;
  notes?: string;
  timestamp: string;
};

type SavedWasteRecord = {
  barcode: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  ndc: string;
  location: string;
  quantity: string;
  reasonCode: string;
  witnessName?: string;
  notes?: string;
  timestamp: string;
};

type SavedTransferRecord = {
  barcode: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  ndc: string;
  fromLocation: string;
  toLocation: string;
  quantity: string;
  notes?: string;
  timestamp: string;
};

type TransactionRow = {
  id: string;
  timestamp: string;
  medication: string;
  action: string;
  quantity: number;
  location: string;
  user: string;
  details?: string;
};

function formatTimestamp(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getActionClasses(action: string) {
  if (action === "Receive") return "bg-blue-100 text-blue-700";
  if (action === "Dispense") return "bg-emerald-100 text-emerald-700";
  if (action === "Adjust") return "bg-amber-100 text-amber-800";
  if (action === "Waste") return "bg-rose-100 text-rose-700";
  if (action === "Transfer") return "bg-indigo-100 text-indigo-700";
  return "bg-slate-100 text-slate-700";
}

function getQuantityClasses(quantity: number) {
  if (quantity > 0) return "text-blue-700";
  if (quantity < 0) return "text-rose-700";
  return "text-slate-700";
}

export default function TransactionsPage() {
  const allRows = useMemo(() => {
    if (typeof window === "undefined") return [];

    const receiveRecords: SavedReceiveRecord[] = JSON.parse(
      localStorage.getItem("medtrak-received-stock") || "[]"
    );

    const dispenseRecords: SavedDispenseRecord[] = JSON.parse(
      localStorage.getItem("medtrak-dispense-log") || "[]"
    );

    const adjustRecords: SavedAdjustRecord[] = JSON.parse(
      localStorage.getItem("medtrak-adjust-log") || "[]"
    );

    const wasteRecords: SavedWasteRecord[] = JSON.parse(
      localStorage.getItem("medtrak-waste-log") || "[]"
    );

    const transferRecords: SavedTransferRecord[] = JSON.parse(
      localStorage.getItem("medtrak-transfer-log") || "[]"
    );

    const receiveRows: TransactionRow[] = receiveRecords.map((item, index) => ({
      id: `receive-${index}-${item.receivedAt}`,
      timestamp: item.receivedAt,
      medication: `${item.medicationName} ${item.strength}`.trim(),
      action: "Receive",
      quantity: Number(item.quantityReceived || 0),
      location: item.location,
      user: "Current User", 
      details: `Lot ${item.lotNumber} • Exp ${item.expirationDate}`,
    }));

    const dispenseRows: TransactionRow[] = dispenseRecords.map((item, index) => ({
      id: `dispense-${index}-${item.timestamp}`,
      timestamp: item.timestamp,
      medication: `${item.medicationName} ${item.strength}`.trim(),
      action: "Dispense",
      quantity: -Number(item.quantity || 0),
      location: item.location,
      user: "Current User",
      details: item.patient
        ? `Patient: ${item.patient}`
        : item.encounterId
        ? `Encounter: ${item.encounterId}`
        : "Medication dispensed",
    }));

    const adjustRows: TransactionRow[] = adjustRecords.map((item, index) => {
      const qty = Number(item.quantity || 0);
      const signedQty = item.adjustmentType === "ADD" ? qty : -qty;

      return {
        id: `adjust-${index}-${item.timestamp}`,
        timestamp: item.timestamp,
        medication: `${item.medicationName} ${item.strength}`.trim(),
        action: "Adjust",
        quantity: signedQty,
        location: item.location,
        user: "Current User",
        details: `${item.adjustmentType} • ${item.reasonCode}`,
      };
    });

    const wasteRows: TransactionRow[] = wasteRecords.map((item, index) => ({
      id: `waste-${index}-${item.timestamp}`,
      timestamp: item.timestamp,
      medication: `${item.medicationName} ${item.strength}`.trim(),
      action: "Waste",
      quantity: -Number(item.quantity || 0),
      location: item.location,
      user: "Current User",
      details: item.reasonCode,
    }));

    const transferRows: TransactionRow[] = transferRecords.map((item, index) => ({
      id: `transfer-${index}-${item.timestamp}`,
      timestamp: item.timestamp,
      medication: `${item.medicationName} ${item.strength}`.trim() || item.barcode,
      action: "Transfer",
      quantity: -Number(item.quantity || 0),
      location: `${item.fromLocation} → ${item.toLocation}`,
      user: "Current User",
      details: item.notes || "Location transfer",
    }));

    return [
      ...receiveRows,
      ...dispenseRows,
      ...adjustRows,
      ...wasteRows,
      ...transferRows,
    ].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">Transactions</h1>
        <p className="mt-2 text-slate-600">
          Review the medication activity ledger across receive, dispense, adjust,
          waste, and transfer actions.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {allRows.length} transaction{allRows.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Medication</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Details</th>
              </tr>
            </thead>

            <tbody>
              {allRows.map((row) => (
                <tr key={row.id} className="bg-slate-50">
                  <td className="rounded-l-2xl px-3 py-3 text-sm text-slate-700">
                    {formatTimestamp(row.timestamp)}
                  </td>

                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">
                      {row.medication}
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getActionClasses(
                        row.action
                      )}`}
                    >
                      {row.action}
                    </span>
                  </td>

                  <td
                    className={`px-3 py-3 text-sm font-semibold ${getQuantityClasses(
                      row.quantity
                    )}`}
                  >
                    {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                  </td>

                  <td className="px-3 py-3 text-sm text-slate-700">
                    {row.location}
                  </td>

                  <td className="px-3 py-3 text-sm text-slate-700">
                    {row.user}
                  </td>

                  <td className="rounded-r-2xl px-3 py-3 text-sm text-slate-600">
                    {row.details || "—"}
                  </td>
                </tr>
              ))}

              {allRows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-10 text-center text-sm text-slate-500"
                  >
                    No transaction records found yet.
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
