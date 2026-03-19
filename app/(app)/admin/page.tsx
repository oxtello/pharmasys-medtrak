import Link from "next/link";

const adminCards = [
  {
    title: "Users",
    description:
      "Manage staff access, roles, active status, and home location assignments.",
    href: "/admin/users",
    badge: "Live",
  },
  {
    title: "Locations",
    description:
      "Manage MedTrak locations, inventory sites, and active-location structure.",
    href: "/admin/locations",
    badge: "Live",
  },
  {
    title: "Barcode Map",
    description:
      "Map manufacturer barcodes to medication master records so scan workflows auto-fill medication details.",
    href: "/admin/barcode-map",
    badge: "New",
  },
  {
    title: "Medications",
    description:
      "Medication master records, controlled schedule classification, and formulary setup.",
    href: "/admin/medications",
    badge: "Next",
  },
];

export default function AdminLandingPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Administration
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Configure access control, locations, barcode mappings, and medication
              master data for MedTrak.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <AdminStatCard label="Sections" value="4" />
            <AdminStatCard label="Users" value="Users" />
            <AdminStatCard label="Sites" value="Locations" />
            <AdminStatCard label="Scans" value="Barcode Map" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {adminCards.map((card) => (
          <div
            key={card.title}
            className="flex h-full flex-col justify-between rounded-2xl border bg-white p-6 shadow-sm"
          >
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  {card.title}
                </h2>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    card.badge === "Live"
                      ? "bg-emerald-100 text-emerald-700"
                      : card.badge === "New"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {card.badge}
                </span>
              </div>

              <p className="text-sm leading-6 text-slate-600">
                {card.description}
              </p>
            </div>

            <div className="mt-6">
              <Link
                href={card.href}
                className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Open section
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Recommended next build
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Now that Barcode Map exists, the next strongest move is wiring inventory
          receive so scanned barcodes pull medication details from the shared admin
          barcode map instead of only fixed demo constants.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/admin/barcode-map"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open Barcode Map
          </Link>

          <Link
            href="/inventory/receive"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Receive
          </Link>
        </div>
      </div>
    </div>
  );
}

function AdminStatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
