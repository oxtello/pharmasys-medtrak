import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __medtrakPrisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __medtrakPool: Pool | undefined;
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!global.__medtrakPool) {
    global.__medtrakPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return global.__medtrakPool;
}

function createPrismaClient() {
  const pool = getPool();
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

export const prisma = global.__medtrakPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__medtrakPrisma = prisma;
}
