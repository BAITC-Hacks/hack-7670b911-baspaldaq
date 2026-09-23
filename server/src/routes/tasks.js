import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { AppError } from "../errors/AppError.js";
import { calculateReadiness, DIMENSIONS } from "../domain/readiness.js";
import { assessConversationReply, conversationInputSchema } from "../domain/conversation.js";
import {
  analysisInputSchema,
  confirmationInputSchema,
  FIELD_KEYS,
  FIELD_LABELS,
  analyzeBusinessSources,
} from "../domain/taskAnalysis.js";

export const tasksRouter = Router();

const taskIdSchema = z.string().min(1).max(120);
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

async function getTaskView(database, taskId, { persistReadiness = true } = {}) {
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

tasksRouter.post("/:taskId/confirm", async (request, response) => {
  const taskId = parseBody(taskIdSchema, request.params.taskId);
  const { fields } = parseBody(confirmationInputSchema, request.body);
  if (new Set(fields.map(({ key }) => key)).size !== fields.length) {
    throw new AppError(422, "DUPLICATE_FIELDS", "Каждое поле можно передать только один раз.");
  }

  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { fields: true } });
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Задача не найдена.");

  const updatedTask = await prisma.$transaction(async (transaction) => {
    for (const { key, value } of fields) {
      const previous = task.fields.find((field) => field.key === key);
      const isManualEdit = value !== previous?.value;
      await transaction.taskField.update({
        where: { taskId_key: { taskId, key } },
        data: {
          value,
          status: "confirmed",
          ...(isManualEdit ? {
            provenance: "manual_edit",
            sourceId: `manual_edit:${key}`,
            evidence: JSON.stringify([{ sourceId: `manual_edit:${key}`, quote: value }]),
          } : {}),
        },
      });
    }

    return recalculate(transaction, taskId);
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("Baspaldaq readiness recalculated", { taskId, score: updatedTask.score, level: updatedTask.level });
  }

  response.json({ task: updatedTask });
});
