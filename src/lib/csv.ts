/**
 * A small CSV reader for the weekly port-status import.
 *
 * Deliberately not a dependency: the input is a handful of rows pasted out of
 * a congestion report, and the quoting rules below cover what a spreadsheet
 * export produces. Anything more exotic belongs in a real parser.
 */

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

/** Split one line, honouring double quotes and doubled quote escapes. */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ",") {
      fields.push(current.trim());
      current = "";
    } else current += char;
  }

  fields.push(current.trim());
  return fields;
}

export function parseCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  const lines = text
    .replace(/^﻿/, "") // Excel writes a BOM; it would corrupt the first header.
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return { headers: [], rows: [], errors: ["The file is empty."] };

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);

    if (values.length !== headers.length) {
      errors.push(`Row ${i + 1}: expected ${headers.length} columns, found ${values.length}.`);
      continue;
    }

    rows.push(Object.fromEntries(headers.map((header, j) => [header, values[j]])));
  }

  return { headers, rows, errors };
}

/** Columns the port-status import expects. */
export const PORT_CSV_COLUMNS = ["unlocode", "observedon", "avgwaitdays"] as const;
export const PORT_CSV_OPTIONAL_COLUMNS = ["vesselswaiting", "note"] as const;

export const PORT_CSV_TEMPLATE = [
  "unlocode,observedOn,avgWaitDays,vesselsWaiting,note",
  "THLCH,2026-10-02,1.8,11,Berthing on schedule",
  "CNSHA,2026-10-02,4.6,28,Fog delays at the outer anchorage",
].join("\n");

export function missingPortColumns(headers: string[]): string[] {
  return PORT_CSV_COLUMNS.filter((column) => !headers.includes(column));
}
