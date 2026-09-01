import {
  app,
  logger
} from "./chunk-S3ZGUTQH.js";

// src/server.ts
import "dotenv/config";
var PORT = process.env.PORT || 3001;
var server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "API server started");
});
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
export {
  server
};
//# sourceMappingURL=server.js.map