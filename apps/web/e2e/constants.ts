// Shared E2E constants. Kept out of any *.spec/*.setup file because Playwright
// forbids test files from importing one another.

/** A fresh owner per run; PG names are stable so specs can assert on them. */
export const OWNER = {
  email: `e2e-owner-${Date.now()}@pgkhata.test`,
  password: "e2e-owner-password-123",
  name: "E2E Owner",
};

export const PG_ONE = "E2E Primary PG";
export const PG_TWO = "E2E Secondary PG";
