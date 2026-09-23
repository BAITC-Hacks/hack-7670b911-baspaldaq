import { createServer } from "node:http";
import { env } from "./config/env.js";
import { createApp } from "./app.js";

const server = createServer(createApp());

server.listen(env.port, () => {
  console.log(`Baspaldaq API listening on port ${env.port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
