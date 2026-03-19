"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Package2,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  ShieldAlert,
  ClipboardList,
  BarChart3,
  Settings,
  Users,
  ChevronRight,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/inventory", label: "Inventory", icon: Package2 },
      { href: "/reports/transactions", label: "Transactions", icon: ClipboardList },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },

  {
    title: "Administration",
    items: [
      { href: "/admin", label: "Admin", icon: Settings },
      { href: "/admin/users", label: "Users", icon: Users },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[280px] shrink-0 border-r border-slate-200 bg-white xl:flex xl:flex-col">
      <div className="border-b border-slate-200 px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-14 w-52 items-center rounded-2xl border border-slate-200 bg-white px-3 shadow-sm">
            <div className="relative h-10 w-full">
              <Image
                src="/Logo_Transparent.png"
                alt="PharmaSys MedTrak"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
          </div>
        </Link>

        <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
          Inventory • Compliance • Operations
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mb-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            System Status
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            MedTrak Live Workspace
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Inventory, reporting, and barcode workflows in one place.
          </p>
        </div>

        <nav className="space-y-6">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {group.title}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "group flex items-center justify-between rounded-2xl px-3 py-3 text-sm font-medium transition",
                        active
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-3">
                        <Icon
                          className={`h-4 w-4 ${
                            active
                              ? "text-white"
                              : "text-slate-400 group-hover:text-slate-700"
                          }`}
                        />
                        {item.label}
                      </span>

                      <ChevronRight
                        className={`h-4 w-4 ${
                          active
                            ? "text-white/90"
                            : "text-slate-300 group-hover:text-slate-500"
                        }`}
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-slate-200 p-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Goal
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            Leading medication inventory platform
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Fast workflows, clean audit trails, enterprise-grade usability.
          </p>
        </div>
      </div>
    </aside>
  );
}
