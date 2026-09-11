import {
  app,
  logger,
  pool
} from "./chunk-GSHGI5JR.js";
import "./chunk-XE73QS3Z.js";
import "./chunk-LIELFINK.js";
import "./chunk-UVNFC7DO.js";
import "./chunk-3OIXDJ6S.js";
import "./chunk-ANSE7BI4.js";
import "./chunk-PZ5AY32C.js";

// src/server.ts
import "dotenv/config";

// src/lib/graceful-shutdown.ts
function installProcessHandlers(options) {
  const processRef = options.processRef ?? process;
  let shuttingDown = false;
  const shutdown = (reason, exitCode) => {
    if (shuttingDown) return;
    shuttingDown = true;
    options.logger.info({ reason, exitCode }, "API shutdown started");
    const timer = setTimeout(() => {
      options.logger.fatal({ reason }, "Graceful shutdown timed out");
      processRef.exit(exitCode || 1);
    }, options.forceExitAfterMs ?? 1e4);
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

// src/server.ts
var PORT = process.env.PORT || 3001;
var server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "API server started");
});
installProcessHandlers({ server, pool, logger });
export {
  server
};
//# sourceMappingURL=server.js.map