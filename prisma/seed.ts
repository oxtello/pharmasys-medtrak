import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  PrismaClient,
  UserRole,
  InventoryUnit,
} from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const mainLocation = await prisma.location.upsert({
    where: { code: "MAIN" },
    update: {
      name: "Main Clinic",
      isActive: true,
    },
    create: {
      name: "Main Clinic",
      code: "MAIN",
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@medtrak.local" },
    update: {
      name: "Admin User",
      role: UserRole.ADMIN,
      homeLocationId: mainLocation.id,
      isActive: true,
    },
    create: {
      name: "Admin User",
      email: "admin@medtrak.local",
      passwordHash: null,
      role: UserRole.ADMIN,
      homeLocationId: mainLocation.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "pharm@medtrak.local" },
    update: {
      name: "Pharmacist User",
      role: UserRole.PHARMACIST,
      homeLocationId: mainLocation.id,
      isActive: true,
    },
    create: {
      name: "Pharmacist User",
      email: "pharm@medtrak.local",
      passwordHash: null,
      role: UserRole.PHARMACIST,
      homeLocationId: mainLocation.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "tech@medtrak.local" },
    update: {
      name: "Technician User",
      role: UserRole.TECHNICIAN,
      homeLocationId: mainLocation.id,
      isActive: true,
    },
    create: {
      name: "Technician User",
      email: "tech@medtrak.local",
      passwordHash: null,
      role: UserRole.TECHNICIAN,
      homeLocationId: mainLocation.id,
      isActive: true,
    },
  });

  await prisma.medicationMaster.upsert({
    where: { barcode: "0123456789012" },
    update: {
      name: "Lidocaine",
      genericName: "Lidocaine",
      strength: "1%",
      dosageForm: "Injection",
      manufacturer: "Demo Manufacturer",
      ndc: "00000-000-00",
      inventoryUnit: InventoryUnit.ML,
      isControlled: false,
      isActive: true,
      isMultiDose: true,
      openedUsePolicy: "DAYS_AFTER_OPEN",
      openedUseDays: 28,
      requiresOpenedDate: true,
      requiresWitnessWaste: false,
      notes: "Seed medication",
    },
    create: {
      name: "Lidocaine",
      genericName: "Lidocaine",
      strength: "1%",
      dosageForm: "Injection",
      manufacturer: "Demo Manufacturer",
      ndc: "00000-000-00",
      barcode: "0123456789012",
      deaSchedule: null,
      inventoryUnit: InventoryUnit.ML,
      isControlled: false,
      isActive: true,
      isMultiDose: true,
      openedUsePolicy: "DAYS_AFTER_OPEN",
      openedUseDays: 28,
      requiresOpenedDate: true,
      requiresWitnessWaste: false,
      notes: "Seed medication",
    },
  });

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
