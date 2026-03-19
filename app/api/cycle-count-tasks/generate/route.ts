import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Candidate = {
  medicationId: string;
  medicationName: string;
  strength: string | null;
  dosageForm: string | null;
  deaSchedule: string | null;
  locationId: string;
  locationName: string;
  score: number;
  reasons: string[];
};

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function deaWeight(deaSchedule: string | null | undefined) {
  switch ((deaSchedule || "").toUpperCase()) {
    case "C2":
      return 40;
    case "C3":
      return 30;
    case "C4":
      return 20;
    case "C5":
      return 10;
    default:
      return 0;
  }
}

function staleWeight(daysSinceLastCount: number | null) {
  if (daysSinceLastCount === null) return 35;
  if (daysSinceLastCount > 60) return 30;
  if (daysSinceLastCount > 30) return 20;
  if (daysSinceLastCount > 14) return 10;
  return 0;
}

function activityWeight(txCount30d: number) {
  if (txCount30d >= 20) return 20;
  if (txCount30d >= 10) return 10;
  return 0;
}

function varianceWeight(varianceCount90d: number) {
  if (varianceCount90d >= 2) return 25;
  if (varianceCount90d >= 1) return 10;
  return 0;
}

function priorityFromScore(score: number) {
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

function shuffle<T>(items: T[]) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedCount = Math.max(1, Math.min(5, Number(body.count || 3)));

    const now = new Date();

    const tx30Cutoff = new Date(now);
    tx30Cutoff.setDate(tx30Cutoff.getDate() - 30);

    const tx90Cutoff = new Date(now);
    tx90Cutoff.setDate(tx90Cutoff.getDate() - 90);

    const recentTaskCutoff = new Date(now);
    recentTaskCutoff.setDate(recentTaskCutoff.getDate() - 7);

    const [
      medications,
      locations,
      openTasks,
      recentTasks,
      transactions
    ] = await Promise.all([
      prisma.medicationMaster.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          strength: true,
          dosageForm: true,
          deaSchedule: true,
        },
      }),

      prisma.location.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
        },
      }),

      prisma.cycleCountTask.findMany({
        where: { status: "OPEN" },
        select: {
          medicationId: true,
          locationId: true,
        },
      }),

      prisma.cycleCountTask.findMany({
        where: {
          createdAt: { gte: recentTaskCutoff },
        },
        select: {
          medicationId: true,
          locationId: true,
        },
      }),

      prisma.inventoryTransaction.findMany({
        where: {
          occurredAt: { gte: tx90Cutoff },
        },
        orderBy: { occurredAt: "desc" },
      }),
    ]);

    const openTaskKeys = new Set(
      openTasks.map((t) => `${t.medicationId}__${t.locationId}`)
    );

    const recentTaskKeys = new Set(
      recentTasks.map((t) => `${t.medicationId}__${t.locationId}`)
    );

    const lastCountMap = new Map<string, Date>();
    const txCount30Map = new Map<string, number>();
    const variance90Map = new Map<string, number>();

    for (const tx of transactions) {
      const key = `${tx.medicationId}__${tx.locationId}`;

      if (tx.occurredAt >= tx30Cutoff && tx.type !== "CYCLE_COUNT") {
        txCount30Map.set(key, (txCount30Map.get(key) || 0) + 1);
      }

      if (tx.type === "CYCLE_COUNT") {
        if (!lastCountMap.has(key)) {
          lastCountMap.set(key, tx.occurredAt);
        }

        const noteText = String(tx.note || "");
        const varianceMatch = noteText.match(/Variance:\s*([-+]?\d*\.?\d+)/i);
        const variance = varianceMatch ? Number(varianceMatch[1]) : 0;

        if (Number.isFinite(variance) && variance !== 0) {
          variance90Map.set(key, (variance90Map.get(key) || 0) + 1);
        }
      }
    }

    const candidates: Candidate[] = [];

    for (const medication of medications) {
      for (const location of locations) {
        const key = `${medication.id}__${location.id}`;

        if (openTaskKeys.has(key)) continue;
        if (recentTaskKeys.has(key)) continue;

        const lastCount = lastCountMap.get(key) || null;
        const daysSinceLastCount = lastCount
          ? daysBetween(now, lastCount)
          : null;

        const txCount30d = txCount30Map.get(key) || 0;
        const varianceCount90d = variance90Map.get(key) || 0;

        let score = 0;
        const reasons: string[] = [];

        const dea = deaWeight(medication.deaSchedule);
        if (dea > 0) reasons.push("DEA_PRIORITY");
        score += dea;

        const stale = staleWeight(daysSinceLastCount);
        if (daysSinceLastCount === null) reasons.push("NEVER_COUNTED");
        else if (daysSinceLastCount > 30) reasons.push("OVERDUE_COUNT");
        score += stale;

        const variance = varianceWeight(varianceCount90d);
        if (varianceCount90d > 0) reasons.push("RECENT_VARIANCE");
        score += variance;

        const activity = activityWeight(txCount30d);
        if (txCount30d >= 10) reasons.push("HIGH_ACTIVITY");
        score += activity;

        if (score === 0) continue;

        candidates.push({
          medicationId: medication.id,
          medicationName: medication.name,
          strength: medication.strength,
          dosageForm: medication.dosageForm,
          deaSchedule: medication.deaSchedule,
          locationId: location.id,
          locationName: location.name,
          score,
          reasons,
        });
      }
    }

    if (!candidates.length) {
      return NextResponse.json({ created: 0, tasks: [] });
    }

    candidates.sort((a, b) => b.score - a.score);

    const poolSize = Math.max(
      requestedCount,
      Math.ceil(candidates.length * 0.25)
    );

    const eligiblePool = candidates.slice(0, poolSize);

    const selected = shuffle(eligiblePool).slice(0, requestedCount);

    const scheduledFor = new Date();
    scheduledFor.setHours(9, 0, 0, 0);

    const createdTasks = await prisma.$transaction(
      selected.map((candidate) =>
        prisma.cycleCountTask.create({
          data: {
            medicationId: candidate.medicationId,
            locationId: candidate.locationId,
            scheduledFor,
            status: "OPEN",
            riskScore: candidate.score,
            priority: priorityFromScore(candidate.score),
            reasonCodes: candidate.reasons.join(","),
          },
        })
      )
    );

    return NextResponse.json({
      created: createdTasks.length,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error("Failed to generate cycle count tasks", error);

    return NextResponse.json(
      { error: "Failed to generate cycle count tasks" },
      { status: 500 }
    );
  }
}
