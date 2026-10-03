import { isAuthFailure, requireAuth } from "@/lib/auth";
import { missingPortColumns, parseCsv } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { riskLevelForWaitDays } from "@/lib/risk";
import { portStatusSchema } from "@/lib/validation";

export const maxDuration = 60;

/**
 * Bulk import of weekly port waiting times from a CSV.
 *
 * Rows are validated individually and reported per row. A single malformed
 * line should not reject a file of thirty good ones — the user would have no
 * way to tell which one was wrong.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: 'Attach the CSV as a form field named "file".' }, { status: 400 });
  }

  const { headers, rows, errors: parseErrors } = parseCsv(await file.text());

  const missing = missingPortColumns(headers);
  if (missing.length > 0) {
    return Response.json(
      { error: `The CSV is missing required columns: ${missing.join(", ")}.` },
      { status: 422 },
    );
  }

  const ports = await prisma.port.findMany({ select: { id: true, unlocode: true } });
  const portIdByLocode = new Map(ports.map((p) => [p.unlocode.toUpperCase(), p.id]));

  const rowErrors: string[] = [...parseErrors];
  let imported = 0;

  for (const [index, raw] of rows.entries()) {
    const lineNumber = index + 2; // +1 for the header, +1 for 1-based lines.

    const candidate = {
      unlocode: (raw.unlocode ?? "").toUpperCase(),
      observedOn: raw.observedon,
      avgWaitDays: Number(raw.avgwaitdays),
      vesselsWaiting: raw.vesselswaiting ? Number(raw.vesselswaiting) : null,
      note: raw.note || null,
    };

    const parsed = portStatusSchema.safeParse(candidate);
    if (!parsed.success) {
      rowErrors.push(`Row ${lineNumber}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
      continue;
    }

    const portId = portIdByLocode.get(parsed.data.unlocode);
    if (!portId) {
      rowErrors.push(`Row ${lineNumber}: "${parsed.data.unlocode}" is not a tracked port.`);
      continue;
    }

    const observedOn = new Date(
      Date.UTC(
        parsed.data.observedOn.getUTCFullYear(),
        parsed.data.observedOn.getUTCMonth(),
        parsed.data.observedOn.getUTCDate(),
      ),
    );

    try {
      await prisma.portStatus.upsert({
        where: { portId_observedOn: { portId, observedOn } },
        create: {
          portId,
          observedOn,
          avgWaitDays: parsed.data.avgWaitDays,
          vesselsWaiting: parsed.data.vesselsWaiting ?? null,
          riskLevel: riskLevelForWaitDays(parsed.data.avgWaitDays),
          source: "CSV_IMPORT",
          note: parsed.data.note ?? null,
          enteredById: auth.user.id,
        },
        update: {
          avgWaitDays: parsed.data.avgWaitDays,
          vesselsWaiting: parsed.data.vesselsWaiting ?? null,
          riskLevel: riskLevelForWaitDays(parsed.data.avgWaitDays),
          source: "CSV_IMPORT",
          note: parsed.data.note ?? null,
          enteredById: auth.user.id,
        },
      });
      imported++;
    } catch (error) {
      rowErrors.push(
        `Row ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return Response.json({
    imported,
    skipped: rowErrors.length,
    errors: rowErrors.slice(0, 50),
  });
}
