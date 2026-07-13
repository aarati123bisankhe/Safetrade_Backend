import { app } from "./app";
import { env } from "./configs/env.config";
import { prisma } from "./configs/database.config";

const server = app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
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
  await prisma.$disconnect();
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
