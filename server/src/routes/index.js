import { Router } from "express";
import { healthRouter } from "./health.js";
import { tasksRouter } from "./tasks.js";
import { marketplaceRouter } from "./marketplace.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/tasks", tasksRouter);
apiRouter.use(marketplaceRouter);
