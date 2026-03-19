"use client";

import Link from "next/link";

const reportCards = [
  {
    title: "On-Hand Inventory",
    description:
      "View current ledger-derived stock balances by medication and location.",
    href: "/reports/on-hand",
  },
  {
    title: "Transactions",
    description:
      "Review immutable inventory movement history across all workflows.",
    href: "/reports/transactions",
  },
  {
    title: "Diversion Control",
    description:
      "Monitor controlled-substance activity, anomalies, and witness-linked events.",
    href: "/reports/diversion-control",
  },
  {
    title: "Reconciliation",
    description:
      "Review finalized reconciliation results, physical counts, variances, and required variance comments.",
    href: "/reports/reconciliation",
  },
  {
    title: "Ledger Integrity",
    description:
      "Verify the tamper-evident hash chain, review integrity status, and confirm the medication ledger has not been altered.",
    href: "/reports/ledger-integrity",
  },
  {
    title: "Compliance Packet",
    description:
      "Prepare an audit-ready summary of reconciliation results and ledger integrity verification.",
    href: "/reports/compliance-packet",
  },
  {
    title: "System Activity",
    description:
      "Review user-facing inventory activity, finalized reconciliation events, and report generation activity in one audit view.",
    href: "/reports/system-activity",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review inventory, compliance, and audit reporting from the database
          ledger.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{card.description}</p>
            <div className="mt-4 text-sm font-medium text-blue-600">
              Open report
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
