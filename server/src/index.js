import { createServer } from "node:http";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { createApp } from "./app.js";

try {
  await prisma.task.count();
} catch {
  console.error("Database is unavailable or migrations are missing. Run npm run prisma:deploy before starting the API.");
  await prisma.$disconnect();
  process.exit(1);
}

const server = createServer(createApp());

server.listen(env.port, () => {
  console.log(`Baspaldaq API listening on port ${env.port}`);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  server.close(async (error) => {
    try {
      await prisma.$disconnect();
    } catch {
      process.exitCode = 1;
    }

    if (error) {
      console.error("HTTP server shutdown failed");
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
