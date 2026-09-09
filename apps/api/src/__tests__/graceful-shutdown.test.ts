import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { installProcessHandlers } from "../lib/graceful-shutdown";

function fixture() {
  const processRef = new EventEmitter() as EventEmitter & { exit: ReturnType<typeof vi.fn> };
  processRef.exit = vi.fn();
  const server = { close: vi.fn((callback: (error?: Error) => void) => callback()) };
  const pool = { end: vi.fn().mockResolvedValue(undefined) };
  const logger = { info: vi.fn(), fatal: vi.fn() };
  installProcessHandlers({
    server,
    pool,
    logger,
    processRef: processRef as unknown as NodeJS.Process,
    forceExitAfterMs: 100,
  });
  return { processRef, server, pool, logger };
}

describe("process lifecycle handlers", () => {
  it("gracefully closes HTTP and PostgreSQL on SIGTERM", async () => {
    const f = fixture();
    f.processRef.emit("SIGTERM");
    await Promise.resolve();
    expect(f.server.close).toHaveBeenCalledOnce();
    expect(f.pool.end).toHaveBeenCalledOnce();
    expect(f.processRef.exit).toHaveBeenCalledWith(0);
  });

  it("logs fatal errors, shuts down once, and exits non-zero", async () => {
    const f = fixture();
    f.processRef.emit("unhandledRejection", new Error("boom"));
    f.processRef.emit("SIGTERM");
    await Promise.resolve();
    expect(f.logger.fatal).toHaveBeenCalled();
    expect(f.server.close).toHaveBeenCalledOnce();
    expect(f.processRef.exit).toHaveBeenCalledWith(1);
  });
});
