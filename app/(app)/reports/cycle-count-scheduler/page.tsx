"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TaskStatus = "OPEN" | "COMPLETED";

type Task = {
  id: string;
  scheduledFor: string;
  status: string;
  riskScore: number;
  priority: string;
  reasonCodes: string;
  completedAt?: string | null;
  countedBy?: string | null;
  medication: {
    name: string;
    strength?: string | null;
    dosageForm?: string | null;
    deaSchedule?: string | null;
    barcode?: string | null;
  };
  location: {
    id?: string;
    name: string;
  };
};

function buildCycleCountHref(task: Task) {
  const params = new URLSearchParams();

  params.set("taskId", task.id);

  if (task.location?.id) {
    params.set("locationId", task.location.id);
  }

  const searchLabel = [
    task.medication.name,
    task.medication.strength,
    task.medication.dosageForm,
  ]
    .filter(Boolean)
    .join(" ");

  if (searchLabel) {
    params.set("search", searchLabel);
  }

  return `/inventory/cycle-count?${params.toString()}`;
}

export default function CycleCountSchedulerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [count, setCount] = useState("3");
  const [statusFilter, setStatusFilter] = useState<TaskStatus>("OPEN");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  async function loadTasks(nextStatus: TaskStatus = statusFilter) {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/cycle-count-tasks?status=${encodeURIComponent(nextStatus)}`,
        { cache: "no-store" }
      );
      const json = await res.json();

      if (res.ok) {
        setTasks(Array.isArray(json.tasks) ? json.tasks : []);
      } else {
        setTasks([]);
        setMessage(json.error || "Failed to load tasks");
      }
    } catch (error) {
      console.error("Failed to load cycle count tasks", error);
      setTasks([]);
      setMessage("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  async function generateTasks() {
    setGenerating(true);
    setMessage("");

    try {
      const res = await fetch("/api/cycle-count-tasks/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          count: Number(count || "3"),
        }),
      });

      const json = await res.json();

      if (res.ok) {
        setMessage(`Created ${json.created || 0} cycle count task(s).`);
        setStatusFilter("OPEN");
        await loadTasks("OPEN");
      } else {
        setMessage(json.error || "Failed to generate tasks");
      }
    } catch (error) {
      console.error("Failed to generate cycle count tasks", error);
      setMessage("Failed to generate tasks");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    loadTasks(statusFilter);
  }, [statusFilter]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Automated Cycle Count Scheduler
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Generate randomized risk-weighted cycle count tasks for weekly
              inventory verification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
            >
              <option value="1">1 task</option>
              <option value="3">3 tasks</option>
              <option value="5">5 tasks</option>
            </select>

            <button
              onClick={generateTasks}
              disabled={generating}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate Tasks"}
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Cycle Count Tasks
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Expected count is intentionally not shown here to reduce counting
              bias.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("OPEN")}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                statusFilter === "OPEN"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Open
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("COMPLETED")}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                statusFilter === "COMPLETED"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-slate-600">Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed px-4 py-6 text-sm text-slate-500">
            {statusFilter === "OPEN"
              ? "No open cycle count tasks."
              : "No completed cycle count tasks."}
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-3 py-3">
                    {statusFilter === "OPEN" ? "Scheduled" : "Scheduled For"}
                  </th>
                  <th className="px-3 py-3">Medication</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Risk Score</th>
                  <th className="px-3 py-3">Reason Codes</th>
                  {statusFilter === "COMPLETED" ? (
                    <>
                      <th className="px-3 py-3">Completed At</th>
                      <th className="px-3 py-3">Counted By</th>
                    </>
                  ) : (
                    <th className="px-3 py-3">Action</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-3">
                      {new Date(task.scheduledFor).toLocaleString()}
                    </td>

                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">
                        {task.medication.name}
                      </div>

                      <div className="text-slate-500">
                        {[
                          task.medication.strength,
                          task.medication.dosageForm,
                          task.medication.deaSchedule,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                    </td>

                    <td className="px-3 py-3">{task.location.name}</td>

                    <td className="px-3 py-3">{task.priority}</td>

                    <td className="px-3 py-3">{task.riskScore}</td>

                    <td className="px-3 py-3">{task.reasonCodes}</td>

                    {statusFilter === "COMPLETED" ? (
                      <>
                        <td className="px-3 py-3">
                          {task.completedAt
                            ? new Date(task.completedAt).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-3 py-3">{task.countedBy || "—"}</td>
                      </>
                    ) : (
                      <td className="px-3 py-3">
                        <Link
                          href={buildCycleCountHref(task)}
                          className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Complete Count
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
