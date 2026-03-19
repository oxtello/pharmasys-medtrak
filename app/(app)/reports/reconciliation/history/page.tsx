"use client";

import { useEffect, useState } from "react";

type Report = {
  id: string;
  locationId: string;
  reviewerName: string;
  reviewerRole: string;
  finalizedAt: string;
  startDate: string;
  endDate: string;
  location: {
    name: string;
  };
};

export default function ReconciliationHistoryPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadReports() {
    setLoading(true);

    try {
      const res = await fetch("/api/reports/reconciliation/history", {
        cache: "no-store",
      });

      const data = await res.json();

      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (error) {
      console.error("Failed to load reconciliation history", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Reconciliation History
        </h1>
        <p className="text-sm text-slate-600">
          View finalized reconciliation reports.
        </p>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-left">Location</th>
              <th className="p-3 text-left">Period</th>
              <th className="p-3 text-left">Reviewed By</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Finalized</th>
            </tr>
          </thead>

          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.location?.name}</td>
                <td className="p-3">
                  {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)}
                </td>
                <td className="p-3">{r.reviewerName}</td>
                <td className="p-3">{r.reviewerRole}</td>
                <td className="p-3">
                  {r.finalizedAt
                    ? new Date(r.finalizedAt).toLocaleString()
                    : "-"}
                </td>
              </tr>
            ))}

            {reports.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  No reconciliation reports found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
