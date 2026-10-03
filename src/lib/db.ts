import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * A single Prisma client for the process.
 *
 * Each instance opens its own pool, and Next's dev server re-evaluates modules
 * on every edit, so without the global cache a long session exhausts Supabase's
 * connection limit within a few saves.
 *
 * The runtime connects through the pooled endpoint (DATABASE_URL, pgbouncer on
 * 6543). Migrations use the direct endpoint instead — see prisma7.config.ts.
 */
function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Prisma returns `Decimal` for money and rate columns. Charts, the AHP engine
 * and JSON responses all want plain numbers, so conversion happens once here
 * rather than being re-invented at each call site.
 */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return Number.NaN;
  return Number(value.toString());
}
