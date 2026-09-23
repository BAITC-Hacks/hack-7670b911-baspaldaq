import { Router } from "express";
import { prisma } from "../db/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (_request, response) => {
  try {
    await prisma.task.count();
  } catch {
    response.status(503).json({
      status: "unavailable",
      service: "baspaldaq-api",
      database: "unavailable",
    });
    return;
  }

  response.json({
    status: "ok",
    service: "baspaldaq-api",
    database: "connected",
  });
});
