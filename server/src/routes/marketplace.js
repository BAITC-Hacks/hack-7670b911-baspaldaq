import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { AppError } from "../errors/AppError.js";

export const marketplaceRouter = Router();

const idSchema = z.string().min(1).max(120);
const teamSchema = z.object({
  name: z.string().trim().min(2).max(120),
  interests: z.string().trim().max(500).default(""),
  skills: z.string().trim().max(500).default(""),
  technologies: z.string().trim().max(500).default(""),
}).strict();
const teamPatchSchema = teamSchema.partial().refine((value) => Object.keys(value).length > 0);
const proposalSchema = z.object({
  teamId: idSchema,
  solutionIdea: z.string().trim().min(10).max(3000),
  plan: z.string().trim().min(10).max(3000),
  timeline: z.string().trim().min(2).max(500),
  prototypeUrl: z.url().max(1000).refine((url) => ["http:", "https:"].includes(new URL(url).protocol), "Укажите ссылку http или https."),
}).strict();
const decisionSchema = z.object({ status: z.enum(["ACCEPTED", "REJECTED"]) }).strict();
const milestoneSchema = z.object({
  teamId: idSchema,
  title: z.string().trim().min(3).max(160),
}).strict();
const MILESTONE_POINTS = 10;

function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError(422, "VALIDATION_ERROR", result.error.issues[0]?.message || "Проверьте введённые данные.");
  return result.data;
}

async function requireTask(taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Задача не найдена.");
  return task;
}

marketplaceRouter.get("/teams", async (_request, response) => {
  response.json({ teams: await prisma.team.findMany({ orderBy: { createdAt: "desc" } }) });
});

marketplaceRouter.post("/teams", async (request, response) => {
  const input = parse(teamSchema, request.body);
  response.status(201).json({ team: await prisma.team.create({ data: input }) });
});

marketplaceRouter.get("/teams/:teamId", async (request, response) => {
  const teamId = parse(idSchema, request.params.teamId);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new AppError(404, "TEAM_NOT_FOUND", "Команда не найдена.");
  response.json({ team });
});

marketplaceRouter.patch("/teams/:teamId", async (request, response) => {
  const teamId = parse(idSchema, request.params.teamId);
  const input = parse(teamPatchSchema, request.body);
  const existing = await prisma.team.findUnique({ where: { id: teamId } });
  if (!existing) throw new AppError(404, "TEAM_NOT_FOUND", "Команда не найдена.");
  response.json({ team: await prisma.team.update({ where: { id: teamId }, data: input }) });
});

marketplaceRouter.get("/tasks/:taskId/proposals", async (request, response) => {
  const taskId = parse(idSchema, request.params.taskId);
  await requireTask(taskId);
  const proposals = await prisma.proposal.findMany({
    where: { taskId }, include: { team: true }, orderBy: { createdAt: "desc" },
  });
  response.json({ proposals });
});

marketplaceRouter.post("/tasks/:taskId/proposals", async (request, response) => {
  const taskId = parse(idSchema, request.params.taskId);
  const input = parse(proposalSchema, request.body);
  const task = await requireTask(taskId);
  if (task.status !== "PUBLISHED") throw new AppError(409, "TASK_NOT_PUBLISHED", "Предложения принимаются только для опубликованных задач.");
  const team = await prisma.team.findUnique({ where: { id: input.teamId } });
  if (!team) throw new AppError(404, "TEAM_NOT_FOUND", "Команда не найдена.");
  const proposal = await prisma.proposal.create({ data: { taskId, ...input }, include: { team: true } });
  response.status(201).json({ proposal });
});

marketplaceRouter.get("/proposals/:proposalId", async (request, response) => {
  const proposalId = parse(idSchema, request.params.proposalId);
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId }, include: { team: true, task: true } });
  if (!proposal) throw new AppError(404, "PROPOSAL_NOT_FOUND", "Предложение не найдено.");
  response.json({ proposal });
});

marketplaceRouter.patch("/proposals/:proposalId/status", async (request, response) => {
  const proposalId = parse(idSchema, request.params.proposalId);
  const { status } = parse(decisionSchema, request.body);
  const existing = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!existing) throw new AppError(404, "PROPOSAL_NOT_FOUND", "Предложение не найдено.");
  const proposal = await prisma.proposal.update({ where: { id: proposalId }, data: { status }, include: { team: true } });
  response.json({ proposal });
});

marketplaceRouter.get("/tasks/:taskId/milestones", async (request, response) => {
  const taskId = parse(idSchema, request.params.taskId);
  await requireTask(taskId);
  response.json({ milestones: await prisma.milestone.findMany({ where: { taskId }, include: { team: true }, orderBy: { createdAt: "desc" } }) });
});

marketplaceRouter.post("/tasks/:taskId/milestones", async (request, response) => {
  const taskId = parse(idSchema, request.params.taskId);
  const { teamId, title } = parse(milestoneSchema, request.body);
  const accepted = await prisma.proposal.findFirst({ where: { taskId, teamId, status: "ACCEPTED" } });
  if (!accepted) throw new AppError(409, "TEAM_NOT_ACCEPTED", "Этап можно создать только для принятой команды.");
  const milestone = await prisma.milestone.create({ data: { taskId, teamId, title } });
  response.status(201).json({ milestone });
});

marketplaceRouter.patch("/milestones/:milestoneId/confirm", async (request, response) => {
  const milestoneId = parse(idSchema, request.params.milestoneId);
  const result = await prisma.$transaction(async (transaction) => {
    const milestone = await transaction.milestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) throw new AppError(404, "MILESTONE_NOT_FOUND", "Этап не найден.");
    if (milestone.confirmedAt) throw new AppError(409, "MILESTONE_ALREADY_CONFIRMED", "Этап уже подтверждён.");
    await transaction.milestone.update({ where: { id: milestoneId }, data: { confirmedAt: new Date(), points: MILESTONE_POINTS } });
    await transaction.team.update({ where: { id: milestone.teamId }, data: { points: { increment: MILESTONE_POINTS } } });
    return transaction.milestone.findUnique({ where: { id: milestoneId }, include: { team: true } });
  });
  response.json({ milestone: result });
});
