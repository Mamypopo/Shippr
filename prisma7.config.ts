import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Migrations run over a *direct* connection. Supabase's pooled endpoint
 * (port 6543, pgbouncer) cannot run DDL in a session, so pointing the CLI at
 * DATABASE_URL would fail halfway through a migration. The app runtime uses
 * the pooled URL instead — see src/lib/db.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
