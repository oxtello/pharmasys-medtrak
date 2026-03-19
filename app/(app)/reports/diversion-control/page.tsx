"use client";

import Link from "next/link";

const reportCards = [
 
{
  title: "Diversion Alerts",
  description:
    "Monitor repeated variance, high waste, after-hours controlled activity, and frequent adjustment patterns.",
  href: "/reports/diversion-control/alerts",
},

 {
    title: "Variance Review",
    description:
      "Review cycle count discrepancies, variance trends, comments, and counted-by history.",
    href: "/reports/diversion-control/variance-review",
  },
  {
    title: "Reconciliation Reports",
    description:
      "Review formal ledger-based reconciliation activity with physical count comparison and audit-ready output.",
    href: "/reports/reconciliation",
  },
  {
    title: "Controlled Substance Activity",
    description:
      "Monitor controlled-medication movement, high-risk transactions, and diversion-sensitive activity.",
    href: "/reports/transactions",
  },
];

export default function DiversionControlPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Diversion Control
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Review discrepancy reporting, reconciliation, and high-risk inventory activity.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              {card.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {card.description}
            </p>
            <div className="mt-4 text-sm font-medium text-slate-900">
              Open report →
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
