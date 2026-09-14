import { describe, expect, it } from "vitest";
import { billReadyEmail } from "@pgkhata/email";
import { formatElectricityTemplateAmount } from "../lib/whatsapp";

describe("WhatsApp bill electricity parameter", () => {
  it("keeps the existing template while adding room and tenant units", () => {
    expect(formatElectricityTemplateAmount(600, [
      "Room usage: 100 units × ₹12/unit",
      "Your share: 50 units × ₹12/unit",
    ])).toBe(
      "600 (Room usage: 100 units × ₹12/unit; Your share: 50 units × ₹12/unit)",
    );
  });

  it("uses Indian number grouping and supports flat electricity", () => {
    expect(formatElectricityTemplateAmount(12500)).toBe("12,500");
  });

  it("includes the same meter breakdown in bill email", () => {
    const html = billReadyEmail({
      tenantName: "Rahul",
      propertyName: "Mukund PG",
      roomNumber: "G01",
      month: "2026-09",
      rentAmount: "₹8,000",
      electricityAmount: "₹600",
      electricityDetails: [
        "Room usage: 100 units × ₹12/unit",
        "Your share: 50 units × ₹12/unit",
      ],
      otherCharges: "₹0",
      totalAmount: "₹8,600",
      balance: "₹8,600",
      dueDate: "13/9/2026",
      invoiceUrl: "https://app.pgkhata.com/invoice/test",
    });

    expect(html).toContain("Electricity (your charge)");
    expect(html).toContain("Room usage: 100 units × ₹12/unit");
    expect(html).toContain("Your share: 50 units × ₹12/unit");
  });
});
