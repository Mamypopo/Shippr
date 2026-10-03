/**
 * Database seed.
 *
 * Ports are reference data and always seeded. Pass `--demo` to also generate
 * a plausible index history and port readings, so the dashboard can be built
 * and reviewed before the first live scrape lands:
 *
 *   npm run db:seed -- --demo
 *
 * Demo rows are written with source MANUAL and a note marking them as sample
 * data, so they are easy to spot and delete.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { HUB_PORTS, riskLevelForWaitDays } from "../src/lib/risk";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Set DATABASE_URL (and ideally DIRECT_URL) before seeding.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic pseudo-random, so repeated demo seeds produce the same series. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function utcDate(offsetDaysFromToday: number): Date {
  const now = new Date();
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(base + offsetDaysFromToday * DAY_MS);
}

/** Most recent UTC Thursday at or before today — the index publication day. */
function lastThursday(): Date {
  const today = utcDate(0);
  const daysSinceThursday = (today.getUTCDay() - 4 + 7) % 7;
  return new Date(today.getTime() - daysSinceThursday * DAY_MS);
}

async function seedPorts(): Promise<number> {
  for (const port of HUB_PORTS) {
    await prisma.port.upsert({
      where: { unlocode: port.unlocode },
      create: port,
      update: {
        name: port.name,
        country: port.country,
        lat: port.lat,
        lon: port.lon,
        sortOrder: port.sortOrder,
        isActive: true,
      },
    });
  }
  return HUB_PORTS.length;
}

async function seedDemoIndices(): Promise<number> {
  const random = seededRandom(20261003);
  const thursday = lastThursday();
  let written = 0;

  const lanes: Array<{
    indexCode: "WCI" | "SCFI";
    routeCode: string;
    unit: "USD_PER_FEU" | "POINTS";
    base: number;
    volatility: number;
  }> = [
    { indexCode: "WCI", routeCode: "COMPOSITE", unit: "USD_PER_FEU", base: 2450, volatility: 90 },
    { indexCode: "WCI", routeCode: "SHA_RTM", unit: "USD_PER_FEU", base: 3180, volatility: 150 },
    { indexCode: "WCI", routeCode: "SHA_LAX", unit: "USD_PER_FEU", base: 2740, volatility: 130 },
    { indexCode: "SCFI", routeCode: "COMPOSITE", unit: "POINTS", base: 1420, volatility: 55 },
  ];

  // 26 weekly readings, oldest first, with a gentle trend plus noise.
  for (const lane of lanes) {
    let value = lane.base;
    for (let week = 25; week >= 0; week--) {
      const drift = (random() - 0.45) * lane.volatility;
      value = Math.max(lane.base * 0.6, value + drift);

      const periodDate = new Date(thursday.getTime() - week * 7 * DAY_MS);

      await prisma.freightIndex.upsert({
        where: {
          indexCode_routeCode_periodDate: {
            indexCode: lane.indexCode,
            routeCode: lane.routeCode,
            periodDate,
          },
        },
        create: {
          indexCode: lane.indexCode,
          routeCode: lane.routeCode,
          periodDate,
          value: Math.round(value * 100) / 100,
          unit: lane.unit,
          source: "MANUAL",
          rawSnapshot: { demo: true },
        },
        update: {},
      });
      written++;
    }
  }

  return written;
}

async function seedDemoPortStatus(): Promise<number> {
  const random = seededRandom(778899);
  const ports = await prisma.port.findMany({ orderBy: { sortOrder: "asc" } });
  let written = 0;

  for (const port of ports) {
    for (let daysAgo = 27; daysAgo >= 0; daysAgo -= 7) {
      const avgWaitDays = Math.round((0.4 + random() * 5.2) * 100) / 100;
      const observedOn = utcDate(-daysAgo);

      await prisma.portStatus.upsert({
        where: { portId_observedOn: { portId: port.id, observedOn } },
        create: {
          portId: port.id,
          observedOn,
          avgWaitDays,
          vesselsWaiting: Math.round(avgWaitDays * 6),
          riskLevel: riskLevelForWaitDays(avgWaitDays),
          source: "MANUAL",
          note: "Sample data from the demo seed.",
        },
        update: {},
      });
      written++;
    }
  }

  return written;
}

async function main(): Promise<void> {
  const demo = process.argv.includes("--demo");

  const ports = await seedPorts();
  console.log(`Seeded ${ports} hub ports.`);

  if (demo) {
    const indices = await seedDemoIndices();
    const statuses = await seedDemoPortStatus();
    console.log(`Seeded ${indices} demo index readings and ${statuses} demo port readings.`);
    console.log("Demo rows are marked source=MANUAL with a demo note — delete them before go-live.");
  } else {
    console.log("Run with --demo to also generate sample index and port history.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
