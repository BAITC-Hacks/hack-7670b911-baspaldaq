import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { AppError } from "./errors/AppError.js";

const configuredOrigins = new Set(process.env.CLIENT_ORIGIN?.split(",").map((origin) => origin.trim()) || []);

function allowClientOrigin(origin, callback) {
  if (!origin || configuredOrigins.has(origin)) {
    callback(null, true);
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      const hostname = new URL(origin).hostname;
      if (["localhost", "127.0.0.1", "::1"].includes(hostname)) {
        callback(null, true);
        return;
      }
    } catch {
      callback(new AppError(403, "ORIGIN_NOT_ALLOWED", "Источник запроса не разрешён."));
      return;
    }
  }

  callback(new AppError(403, "ORIGIN_NOT_ALLOWED", "Источник запроса не разрешён."));
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: allowClientOrigin }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
