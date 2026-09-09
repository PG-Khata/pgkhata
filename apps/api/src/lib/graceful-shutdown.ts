type Logger = {
  info: (details: unknown, message?: string) => void;
  fatal: (details: unknown, message?: string) => void;
};

type Server = {
  close: (callback: (error?: Error) => void) => void;
};

type Pool = { end: () => Promise<void> };

export function installProcessHandlers(options: {
  server: Server;
  pool: Pool;
  logger: Logger;
  processRef?: NodeJS.Process;
  forceExitAfterMs?: number;
}) {
  const processRef = options.processRef ?? process;
  let shuttingDown = false;

  const shutdown = (reason: string, exitCode: number) => {
    if (shuttingDown) return;
    shuttingDown = true;
    options.logger.info({ reason, exitCode }, "API shutdown started");

    const timer = setTimeout(() => {
      options.logger.fatal({ reason }, "Graceful shutdown timed out");
      processRef.exit(exitCode || 1);
    }, options.forceExitAfterMs ?? 10_000);
    timer.unref();

    options.server.close(async (error) => {
      if (error) options.logger.fatal({ err: error }, "HTTP server close failed");
      try {
        await options.pool.end();
      } catch (poolError) {
        options.logger.fatal({ err: poolError }, "Database pool close failed");
        exitCode = 1;
      } finally {
        clearTimeout(timer);
        processRef.exit(error ? 1 : exitCode);
      }
    });
  };

  processRef.once("SIGTERM", () => shutdown("SIGTERM", 0));
  processRef.once("SIGINT", () => shutdown("SIGINT", 0));
  processRef.once("uncaughtException", (error) => {
    options.logger.fatal({ err: error }, "Uncaught exception");
    shutdown("uncaughtException", 1);
  });
  processRef.once("unhandledRejection", (reason) => {
    options.logger.fatal({ err: reason }, "Unhandled rejection");
    shutdown("unhandledRejection", 1);
  });

  return { shutdown };
}
