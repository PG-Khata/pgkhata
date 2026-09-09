import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const auditedCollections = [
  "billing", "payments", "tenants", "beds", "readings", "expenses",
  "advance-payments", "security-deposits", "bed-bookings", "properties",
  "staff", "tenant-documents", "admin-documents",
];

describe("audited collection bounds", () => {
  it.each(auditedCollections)("keeps %s database queries page-bounded", (route) => {
    const source = readFileSync(resolve(import.meta.dirname, `../routes/${route}.ts`), "utf8");
    expect(source).toContain("pagination(req)");
    expect(source).toContain(".limit(page.limit)");
    expect(source).toContain("sendPage(res");
  });

  it("caps both CSV exports", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../routes/exports.ts"), "utf8");
    expect(source.match(/\.limit\(MAX_EXPORT_ROWS \+ 1\)/g)).toHaveLength(2);
    expect(source.match(/Export exceeds/g)).toHaveLength(2);
  });
});
