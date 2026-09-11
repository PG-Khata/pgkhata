export type CsvValue = string | number | null | undefined;

/** Renders rows as RFC 4180 CSV, quoting only cells that need it. */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const escape = (v: CsvValue) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}
