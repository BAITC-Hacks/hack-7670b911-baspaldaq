import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { AppError } from "../errors/AppError.js";
import { calculateReadiness, DIMENSIONS } from "../domain/readiness.js";
import { assessConversationReply, conversationInputSchema } from "../domain/conversation.js";
import {
  analysisInputSchema,
  DIMENSION_FIELDS,
  FIELD_KEYS,
  FIELD_LABELS,
  analyzeBusinessSources,
} from "../domain/taskAnalysis.js";

export const tasksRouter = Router();

const taskIdSchema = z.string().min(1).max(120);
const cardInputSchema = z.object({
  fields: z.array(z.object({
    key: z.enum(FIELD_KEYS),
    value: z.string().trim().max(1000),
  }).strict()).max(FIELD_KEYS.length),
  topic: z.string().trim().max(80).nullable().optional(),
}).strict();
const catalogQuerySchema = z.object({
  published: z.enum(["true", "false"]).default("true"),
  readiness: z.enum(["draft", "workable", "ready", "priority"]).optional(),
  topic: z.string().trim().min(1).max(80).optional(),
  sort: z.enum(["score_desc", "score_asc", "newest"]).default("score_desc"),
}).strict();
const taskInclude = {
  fields: { orderBy: { createdAt: "asc" } },
  dimensions: true,
  messages: { orderBy: { createdAt: "asc" } },
  questions: {
    include: { answer: true },
    orderBy: { createdAt: "asc" },
  },
};

function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues[0]?.message || "Проверьте введённые данные.";
    throw new AppError(422, "VALIDATION_ERROR", message);
  }
  return result.data;
}

function readJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function persistConversationMessages(transaction, taskId, questionId, messages) {
  const baseTime = Date.now();
  for (const [index, message] of messages.entries()) {
    await transaction.taskMessage.create({
      data: {
        taskId,
        questionId,
        ...message,
        createdAt: new Date(baseTime + index),
      },
    });
  }
}

function getEffectiveDimensions(task) {
  return task.dimensions.map((dimension) => {
    const evidence = readJson(dimension.evidence, []);
    const supportedByUserText = evidence.length > 0;

    return {
      key: dimension.key,
      label: DIMENSIONS.find(({ key }) => key === dimension.key)?.label || dimension.key,
      status: supportedByUserText ? dimension.aiStatus : "missing",
      aiStatus: dimension.aiStatus,
      confirmed: supportedByUserText,
      evidence,
    };
  });
}

export async function getTaskView(database, taskId, { persistReadiness = true } = {}) {
  const task = await database.task.findUnique({ where: { id: taskId }, include: taskInclude });
  if (!task) return null;

  const dimensions = getEffectiveDimensions(task);
  const readiness = calculateReadiness(dimensions.map(({ key, status, confirmed, evidence }) => ({
    key,
    status,
    confirmed,
    evidence,
  })));
  const persisted = persistReadiness
    ? await database.task.update({
      where: { id: taskId },
      data: { score: readiness.score, level: readiness.level },
    })
    : task;

  return {
    id: persisted.id,
    description: persisted.description,
    score: readiness.score,
    level: readiness.level,
    status: persisted.status,
    topic: persisted.topic,
    confirmedAt: persisted.confirmedAt,
    publishedAt: persisted.publishedAt,
    createdAt: persisted.createdAt,
    updatedAt: persisted.updatedAt,
    fields: task.fields.map((field) => ({
      key: field.key,
      label: FIELD_LABELS[field.key] || field.key,
      value: field.value,
      status: field.status,
      provenance: field.provenance,
      sourceId: field.sourceId,
      evidence: readJson(field.evidence || "[]", []),
    })),
    dimensions,
    readiness,
    questions: task.questions.map((question) => ({
      id: question.id,
      question: question.question,
      targetDimensions: readJson(question.targetDimensions, []),
      status: question.status,
      retryCount: question.retryCount,
      answer: question.answer?.answer || null,
      createdAt: question.createdAt,
      answeredAt: question.answeredAt,
    })),
    messages: task.messages.map((message) => ({
      id: message.id,
      questionId: message.questionId,
      role: message.role,
      kind: message.kind,
      content: message.content,
      createdAt: message.createdAt,
    })),
  };
}

async function applyAnalysis(transaction, taskId, analysis) {
  for (const key of FIELD_KEYS) {
    const fact = analysis.extracted[key];
    const existing = await transaction.taskField.findUnique({ where: { taskId_key: { taskId, key } } });
    if (existing?.status === "confirmed") continue;

    const evidence = fact.evidence;
    const firstSourceId = evidence[0]?.sourceId || null;
    const provenance = firstSourceId?.startsWith("answer:")
      ? "clarification_answer"
      : "initial_description";
    const update = {
      value: fact.value,
      status: "pending",
      provenance,
      sourceId: firstSourceId,
      evidence: evidence.length ? JSON.stringify(evidence) : null,
    };

    await transaction.taskField.upsert({
      where: { taskId_key: { taskId, key } },
      create: { taskId, key, ...update },
      update,
    });
  }

  for (const { key } of DIMENSIONS) {
    const dimension = analysis.dimensions[key];
    await transaction.taskDimension.upsert({
      where: { taskId_key: { taskId, key } },
      create: { taskId, key, aiStatus: dimension.status, evidence: JSON.stringify(dimension.evidence) },
      update: { aiStatus: dimension.status, evidence: JSON.stringify(dimension.evidence) },
    });
  }

  await transaction.clarificationQuestion.updateMany({
    where: { taskId, status: "open" },
    data: { status: "superseded" },
  });

  if (analysis.questions.length) {
    await transaction.clarificationQuestion.createMany({
      data: analysis.questions.map((question) => ({
        taskId,
        question: question.question,
        targetDimensions: JSON.stringify(question.targetDimensions),
        reason: question.reason,
      })),
    });
  }
}

async function recalculate(database, taskId) {
  const task = await getTaskView(database, taskId);
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Задача не найдена.");
  return task;
}

tasksRouter.post("/analyze", async (request, response) => {
  const { description } = parseBody(analysisInputSchema, request.body);
  const analysis = await analyzeBusinessSources([{ id: "description", text: description }]);
  const task = await prisma.$transaction(async (transaction) => {
    const created = await transaction.task.create({ data: { description } });
    await applyAnalysis(transaction, created.id, analysis);
    return recalculate(transaction, created.id);
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("Baspaldaq readiness recalculated", { taskId: task.id, score: task.score, level: task.level });
  }

  response.status(201).json({ task });
});

tasksRouter.post("/", async (request, response) => {
  const { description } = parseBody(analysisInputSchema, request.body);
  const created = await prisma.task.create({ data: { description, status: "DRAFT" } });
  response.status(201).json({ task: await getTaskView(prisma, created.id) });
});

tasksRouter.get("/", async (request, response) => {
  const filters = parseBody(catalogQuerySchema, request.query);
  const tasks = await prisma.task.findMany({
    where: {
      status: filters.published === "true" ? "PUBLISHED" : { not: "PUBLISHED" },
      ...(filters.readiness ? { level: filters.readiness } : {}),
      ...(filters.topic ? { topic: { contains: filters.topic } } : {}),
    },
    include: { fields: { where: { key: { in: ["title", "need", "expectedResult"] } } }, _count: { select: { proposals: true } } },
    orderBy: filters.sort === "newest" ? [{ publishedAt: "desc" }, { createdAt: "desc" }]
      : [{ score: filters.sort === "score_asc" ? "asc" : "desc" }, { publishedAt: "desc" }],
  });
  response.json({ tasks: tasks.map((task) => ({
    id: task.id,
    title: task.fields.find(({ key }) => key === "title")?.value || task.description.slice(0, 80),
    need: task.fields.find(({ key }) => key === "need")?.value || task.description,
    expectedResult: task.fields.find(({ key }) => key === "expectedResult")?.value || null,
    topic: task.topic,
    score: task.score,
    level: task.level,
    status: task.status,
    publishedAt: task.publishedAt,
    proposalCount: task._count.proposals,
  })) });
});

tasksRouter.post("/:taskId/analyze", async (request, response) => {
  const taskId = parseBody(taskIdSchema, request.params.taskId);
  const record = await prisma.task.findUnique({ where: { id: taskId } });
  if (!record) throw new AppError(404, "TASK_NOT_FOUND", "Задача не найдена.");
  if (record.status === "PUBLISHED") throw new AppError(409, "TASK_PUBLISHED", "Опубликованную задачу нельзя переанализировать.");
  const analysis = await analyzeBusinessSources([{ id: "description", text: record.description }]);
  const task = await prisma.$transaction(async (transaction) => {
    await applyAnalysis(transaction, taskId, analysis);
    await transaction.task.update({ where: { id: taskId }, data: { status: "CLARIFYING", confirmedAt: null } });
    return recalculate(transaction, taskId);
  });
  response.json({ task });
});

tasksRouter.get("/:taskId/questions", async (request, response) => {
  const taskId = parseBody(taskIdSchema, request.params.taskId);
  const task = await getTaskView(prisma, taskId, { persistReadiness: false });
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Задача не найдена.");
  response.json({ questions: task.questions });
});

tasksRouter.get("/:taskId", async (request, response) => {
  const taskId = parseBody(taskIdSchema, request.params.taskId);
  const task = await getTaskView(prisma, taskId, { persistReadiness: false });
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Задача не найдена.");
  response.json({ task });
});

tasksRouter.post("/:taskId/answers", async (request, response) => {
  const taskId = parseBody(taskIdSchema, request.params.taskId);
  const input = parseBody(conversationInputSchema, request.body);
  const { questionId, skip } = input;
  const message = input.message ?? input.answer;
  const question = await prisma.clarificationQuestion.findFirst({ where: { id: questionId, taskId } });
  if (!question) throw new AppError(404, "QUESTION_NOT_FOUND", "Вопрос не найден для этой задачи.");
  if (question.status !== "open") throw new AppError(409, "QUESTION_ALREADY_ANSWERED", "Этот вопрос уже обработан. Обновите задачу.");

  const taskRecord = await prisma.task.findUnique({
    where: { id: taskId },
    include: { answers: { orderBy: { createdAt: "asc" } }, questions: true },
  });
  if (!taskRecord) throw new AppError(404, "TASK_NOT_FOUND", "Задача не найдена.");
  if (taskRecord.status === "PUBLISHED") throw new AppError(409, "TASK_PUBLISHED", "Задача уже опубликована.");

  if (skip) {
    await prisma.$transaction(async (transaction) => {
      await transaction.clarificationQuestion.update({
        where: { id: questionId },
        data: { status: "skipped" },
      });
      await persistConversationMessages(transaction, taskId, questionId, [
        { role: "user", kind: "skip", content: "Пропустить вопрос" },
        { role: "assistant", kind: "skip", content: "Хорошо, не будем задерживаться. Перейдём дальше; этот критерий пока останется в рекомендациях." },
      ]);
    });
    response.json({
      task: await getTaskView(prisma, taskId, { persistReadiness: false }),
      outcome: { type: "skipped" },
    });
    return;
  }

  const targetDimensions = readJson(question.targetDimensions, []);
  const assessment = await assessConversationReply(question, message, taskRecord.description);
  const coversTarget = assessment.coveredDimensions.some((dimension) => targetDimensions.includes(dimension));

  if (assessment.kind === "customer_question") {
    await prisma.$transaction((transaction) => persistConversationMessages(transaction, taskId, questionId, [
      { role: "user", kind: "customer_question", content: message },
      { role: "assistant", kind: "customer_answer", content: assessment.reply },
    ]));
    response.json({
      task: await getTaskView(prisma, taskId, { persistReadiness: false }),
      outcome: { type: "customer_question", reply: assessment.reply, questionId },
    });
    return;
  }

  const answerIsUseful = assessment.kind === "answer" && assessment.sufficient && coversTarget;
  if (!answerIsUseful) {
    const shouldSkip = question.retryCount >= 1;
    const reply = shouldSkip
      ? "Не будем задерживаться на этом вопросе. Пропустим его, а готовность задачи пока останется на прежнем уровне."
      : assessment.reply;

    await prisma.$transaction(async (transaction) => {
      const responseMessages = [
        { role: "user", kind: "answer_attempt", content: message },
        { role: "assistant", kind: shouldSkip ? "skip" : "clarification", content: reply },
      ];
      if (!shouldSkip && assessment.guidance) {
        responseMessages.push({ role: "assistant", kind: "guidance", content: assessment.guidance });
      }
      await persistConversationMessages(transaction, taskId, questionId, responseMessages);
      await transaction.clarificationQuestion.update({
        where: { id: questionId },
        data: shouldSkip
          ? { status: "skipped" }
          : {
            question: assessment.rephrasedQuestion || question.question,
            retryCount: { increment: 1 },
          },
      });
    });
    response.json({
      task: await getTaskView(prisma, taskId, { persistReadiness: false }),
      outcome: {
        type: shouldSkip ? "skipped" : "retry",
        reply,
        guidance: shouldSkip ? null : assessment.guidance,
        questionId,
      },
    });
    return;
  }

  const sources = [
    { id: "description", text: taskRecord.description },
    ...taskRecord.answers.map((item) => ({ id: `answer:${item.questionId}`, text: item.answer })),
    { id: `answer:${questionId}`, text: message },
  ];
  const previouslyAsked = taskRecord.questions.map(({ question: text }) => text);
  const analysis = await analyzeBusinessSources(sources, previouslyAsked);
  const previousTask = await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  const previousScore = calculateReadiness(getEffectiveDimensions(previousTask)).score;

  const updatedTask = await prisma.$transaction(async (transaction) => {
    await transaction.clarificationAnswer.create({ data: { taskId, questionId, answer: message } });
    await transaction.clarificationQuestion.update({
      where: { id: questionId },
      data: { status: "answered", answeredAt: new Date() },
    });
    await applyAnalysis(transaction, taskId, analysis);
    return recalculate(transaction, taskId);
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("Baspaldaq readiness recalculated", { taskId, score: updatedTask.score, level: updatedTask.level });
  }

  response.json({
    task: updatedTask,
    outcome: {
      type: "accepted",
      reply: "Спасибо, это помогло прояснить задачу.",
      scoreDelta: updatedTask.readiness.score - previousScore,
    },
  });
});

tasksRouter.patch("/:taskId", async (request, response) => {
  const taskId = parseBody(taskIdSchema, request.params.taskId);
  const { fields, topic } = parseBody(cardInputSchema, request.body);
  if (new Set(fields.map(({ key }) => key)).size !== fields.length) {
    throw new AppError(422, "DUPLICATE_FIELDS", "Каждое поле можно передать только один раз.");
  }

  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { fields: true } });
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Задача не найдена.");
  if (task.status === "PUBLISHED") throw new AppError(409, "TASK_PUBLISHED", "Опубликованную задачу нельзя изменить.");

  const updatedTask = await prisma.$transaction(async (transaction) => {
    const touched = new Set(fields.map(({ key }) => key));
    for (const { key, value } of fields) {
      const previous = task.fields.find((field) => field.key === key);
      const isManualEdit = value !== previous?.value;
      await transaction.taskField.upsert({
        where: { taskId_key: { taskId, key } },
        create: { taskId, key, value: value || null, status: value ? "confirmed" : "pending", provenance: "manual_edit", sourceId: value ? `manual_edit:${key}` : null, evidence: value ? JSON.stringify([{ sourceId: `manual_edit:${key}`, quote: value }]) : null },
        update: { value: value || null, status: value ? "confirmed" : "pending", ...(isManualEdit ? { provenance: "manual_edit", sourceId: value ? `manual_edit:${key}` : null, evidence: value ? JSON.stringify([{ sourceId: `manual_edit:${key}`, quote: value }]) : null } : {}) },
      });
    }

    const currentFields = await transaction.taskField.findMany({ where: { taskId } });
    for (const [dimensionKey, keys] of Object.entries(DIMENSION_FIELDS)) {
      if (!keys.some((key) => touched.has(key))) continue;
      const values = keys.map((key) => currentFields.find((field) => field.key === key)).filter((field) => field?.value);
      const evidence = values.map((field) => ({ sourceId: field.sourceId || `manual_edit:${field.key}`, quote: field.value }));
      const aiStatus = values.length === 0 ? "missing" : values.length === keys.length ? "complete" : "partial";
      await transaction.taskDimension.upsert({
        where: { taskId_key: { taskId, key: dimensionKey } },
        create: { taskId, key: dimensionKey, aiStatus, evidence: JSON.stringify(evidence) },
        update: { aiStatus, evidence: JSON.stringify(evidence) },
      });
    }
    await transaction.task.update({ where: { id: taskId }, data: { ...(topic !== undefined ? { topic } : {}), status: "CLARIFYING", confirmedAt: null } });

    return recalculate(transaction, taskId);
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("Baspaldaq readiness recalculated", { taskId, score: updatedTask.score, level: updatedTask.level });
  }

  response.json({ task: updatedTask });
});

tasksRouter.post("/:taskId/confirm", async (request, response) => {
  const taskId = parseBody(taskIdSchema, request.params.taskId);
  const record = await prisma.task.findUnique({ where: { id: taskId }, include: { fields: true } });
  if (!record) throw new AppError(404, "TASK_NOT_FOUND", "Задача не найдена.");
  if (record.status === "PUBLISHED") throw new AppError(409, "TASK_PUBLISHED", "Задача уже опубликована.");
  const required = ["title", "need"];
  if (required.some((key) => !record.fields.find((field) => field.key === key)?.value?.trim())) {
    throw new AppError(422, "CARD_INCOMPLETE", "Для подтверждения заполните название и потребность в карточке.");
  }
  await prisma.task.update({ where: { id: taskId }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
  response.json({ task: await getTaskView(prisma, taskId, { persistReadiness: false }) });
});

tasksRouter.post("/:taskId/publish", async (request, response) => {
  const taskId = parseBody(taskIdSchema, request.params.taskId);
  const record = await prisma.task.findUnique({ where: { id: taskId } });
  if (!record) throw new AppError(404, "TASK_NOT_FOUND", "Задача не найдена.");
  if (record.status !== "CONFIRMED") throw new AppError(409, "TASK_NOT_CONFIRMED", "Сначала подтвердите карточку задачи.");
  await getTaskView(prisma, taskId);
  await prisma.task.update({ where: { id: taskId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  response.json({ task: await getTaskView(prisma, taskId, { persistReadiness: false }) });
});
