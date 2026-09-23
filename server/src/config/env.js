import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.resolve(currentDirectory, "../../../.env"),
  quiet: true,
});

const requiredVariables = ["PORT", "CLIENT_ORIGIN", "DATABASE_URL"];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  throw new Error(`Missing environment variables: ${missingVariables.join(", ")}`);
}

const port = Number(process.env.PORT);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const aiTimeoutMs = Number(process.env.AI_TIMEOUT_MS || 30000);

if (!Number.isInteger(aiTimeoutMs) || aiTimeoutMs < 1000 || aiTimeoutMs > 120000) {
  throw new Error("AI_TIMEOUT_MS must be an integer between 1000 and 120000");
}

export const env = Object.freeze({
  port,
  clientOrigin: process.env.CLIENT_ORIGIN,
  databaseUrl: process.env.DATABASE_URL,
  openAiApiKey: process.env.OPENAI_API_KEY || null,
  openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  aiTimeoutMs,
  nodeEnv: process.env.NODE_ENV || "development",
});
