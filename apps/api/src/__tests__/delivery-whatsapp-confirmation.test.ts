import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  inserted: [] as Array<Record<string, unknown>>,
  sendBillNotification: vi.fn(),
}));

vi.mock("@pgkhata/db", () => ({
  db: {
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        h.inserted.push(values);
      },
    }),
  },
  messageDelivery: {},
  bill: {},
  tenant: {},
  room: {},
  property: {},
}));

vi.mock("../lib/whatsapp", () => ({
  isWhatsAppConfigured: () => true,
  sendBillNotification: h.sendBillNotification,
}));

vi.mock("../lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const { deliverBill } = await import("../lib/delivery");

beforeEach(() => {
  h.inserted.length = 0;
  h.sendBillNotification.mockReset();
});

describe("WhatsApp acknowledgement semantics", () => {
  it("does not call a Meta-accepted message sent before the webhook confirms it", async () => {
    h.sendBillNotification.mockResolvedValue({ success: true, messageId: "wamid.ACCEPTED" });

    const results = await deliverBill({
      bill: {
        id: "bill-1",
        billMonth: "2026-09",
        totalAmount: 8600,
        balance: 8600,
        dueDate: "2026-09-13",
        accessToken: "token-1",
        lineItems: [
          { code: "RENT", amount: 8000 },
          { code: "ELEC", amount: 600, units: 50, roomUnits: 100, ratePerUnit: 12, openingReading: 900, closingReading: 1000 },
        ],
      },
      tenant: {
        id: "tenant-1",
        propertyId: "property-1",
        name: "Rahul",
        phone: "8294495929",
        email: null,
      },
      roomNumber: "G01",
      propertyName: "Mukund PG",
      upiId: null,
    } as never, ["whatsapp"]);

    expect(results).toEqual([{
      channel: "whatsapp",
      status: "queued",
      reason: "Waiting for delivery confirmation from WhatsApp",
    }]);
    expect(h.sendBillNotification).toHaveBeenCalledWith(expect.objectContaining({
      electricityAmount: 600,
      electricityDetails: [
        "Room usage: 100 units × ₹12/unit",
        "Your share: 50 units × ₹12/unit",
      ],
    }));
    expect(h.inserted[0]).toMatchObject({
      channel: "whatsapp",
      status: "queued",
      providerMessageId: "wamid.ACCEPTED",
      error: null,
      costUnits: 0,
    });
  });
});
