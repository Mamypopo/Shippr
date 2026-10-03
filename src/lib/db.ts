import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * A single Prisma client for the process, created on first use.
 *
 * The laziness is load-bearing, not a micro-optimisation. Next evaluates
 * every route module at build time to collect its configuration, so a client
 * constructed at import time fails the build on any host that does not expose
 * the database URL to the build step — which is the normal case on Vercel.
 * Connecting is a runtime concern, so it happens at runtime.
 *
 * The global cache matters for a different reason: each instance opens its own
 * pool, and the dev server re-evaluates modules on every edit, so without it a
 * long session exhausts Supabase's connection limit within a few saves.
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

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const client = createClient();
    // Cache in production too: a serverless instance handles many requests,
    // and rebuilding the pool per request would be worse than the leak risk
    // the dev-only guard originally protected against.
    globalForPrisma.prisma = client;
  }
  return globalForPrisma.prisma;
}

/**
 * Proxy so `prisma.model.findMany()` reads naturally at call sites while the
 * real client is still only built on the first property access.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, property) {
    return Reflect.has(getClient(), property);
  },
});

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
