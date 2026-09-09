import { vi } from "vitest";

vi.mock("@pgkhata/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@pgkhata/email")>()),
  sendEmail: vi.fn().mockResolvedValue({ id: "test-email" }),
}));
