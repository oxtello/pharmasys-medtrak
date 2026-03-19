"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buildVialLabelFilename,
  buildVialLabelZpl,
  copyTextToClipboard,
  downloadZplFile,
} from "@/lib/zebra-vial-label";

export default function AdminLabelsPage() {
  const [containerId, setContainerId] = useState("CONT-000001");
  const [medicationName, setMedicationName] = useState("Lidocaine");
  const [strength, setStrength] = useState("1%");
  const [budDate, setBudDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 28);
    return date.toISOString().slice(0, 10);
  });
  const [copied, setCopied] = useState(false);

  const zpl = useMemo(() => {
    return buildVialLabelZpl({
      containerId,
      medicationName,
      strength,
      budDate,
    });
  }, [containerId, medicationName, strength, budDate]);

  function handleDownload() {
    downloadZplFile(
      buildVialLabelFilename({
        containerId,
        medicationName,
        strength,
        budDate,
      }),
      zpl
    );
  }

  async function handleCopy() {
    await copyTextToClipboard(zpl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Zebra Vial Label
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Generate the 1&quot; x 0.5&quot; DataMatrix vial label with BUD
            printed for staff reference.
          </p>
        </div>

        <Link
          href="/admin"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Back to Admin
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Label Inputs
          </h2>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Container ID
              </label>
              <input
                value={containerId}
                onChange={(e) => setContainerId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="CONT-000001"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Medication Name
              </label>
              <input
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="Lidocaine"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Strength
              </label>
              <input
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="1%"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                BUD Date
              </label>
              <input
                type="date"
                value={budDate}
                onChange={(e) => setBudDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleDownload}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Download ZPL
            </button>

            <button
              onClick={handleCopy}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {copied ? "Copied" : "Copy ZPL"}
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Use the downloaded <span className="font-semibold">.zpl</span> file
            with your Zebra workflow during testing. Once verified, we will call
            the same generator automatically from the Open Container action.
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Label Preview
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Preview only. The real barcode prints from the ZPL.
            </p>

            <div className="mt-5 flex justify-start">
              <div className="h-[150px] w-[300px] rounded-md border-2 border-slate-900 bg-white p-3">
                <div className="flex h-full gap-3">
                  <div className="flex w-[98px] items-center justify-center border border-slate-900 bg-slate-50 text-[10px] font-semibold text-slate-700">
                    DATAMATRIX
                  </div>

                  <div className="flex flex-1 flex-col justify-center overflow-hidden">
                    <div className="truncate text-[18px] font-bold uppercase leading-tight text-slate-900">
                      {medicationName} {strength}
                    </div>
                    <div className="mt-4 text-[16px] font-semibold uppercase leading-tight text-slate-900">
                      {budDate
                        ? `BUD ${new Date(budDate)
                            .toLocaleDateString("en-US", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                            .replace(",", "")
                            .toUpperCase()}`
                        : "BUD -- --- ----"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Generated ZPL</h2>
            </div>

            <pre className="mt-4 overflow-x-auto rounded-xl bg-black/30 p-4 text-xs text-emerald-300">
{zpl}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
