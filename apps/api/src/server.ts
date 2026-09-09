import "dotenv/config";
import { app, logger } from "./index";
import { pool } from "@pgkhata/db";
import { installProcessHandlers } from "./lib/graceful-shutdown";

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "API server started");
});

installProcessHandlers({ server, pool, logger });

export { server };
