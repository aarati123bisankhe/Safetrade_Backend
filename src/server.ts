import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { app } from "./app";
import { connectDatabase, disconnectDatabase } from "./configs/database.config";
import { env } from "./configs/env.config";
import {
  getRedisClient,
  hasRedisConnectionAttempted,
  isRedisRateLimitEnabled,
} from "./configs/redis.config";

const startServer = async () => {
  await connectDatabase();
  getRedisClient();

  const isHttpsEnabled = Boolean(env.httpsKeyPath && env.httpsCertPath);
  const server = isHttpsEnabled
    ? https.createServer(
        {
          key: fs.readFileSync(env.httpsKeyPath as string),
          cert: fs.readFileSync(env.httpsCertPath as string),
        },
        app,
      )
    : http.createServer(app);

  server.listen(env.port, () => {
    const protocol = isHttpsEnabled ? "https" : "http";
    console.log(`Server running on ${protocol}://localhost:${env.port}`);

    if (isRedisRateLimitEnabled()) {
      console.log("Redis-backed rate limiting is enabled");
    } else if (env.redisEnabled && hasRedisConnectionAttempted()) {
      console.log("Redis rate limiting is unavailable, using in-memory fallback");
    }
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${env.port} is already in use. Stop the other process or change PORT in .env.`,
      );
      process.exit(1);
    }

    console.error(error);
    process.exit(1);
  });

  const shutdown = async () => {
    await disconnectDatabase();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

void startServer().catch((error: unknown) => {
  console.error("Failed to start server");
  console.error(error);
  process.exit(1);
});
