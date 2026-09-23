import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../errors/AppError.js";
import {
  analysisInputSchema,
  answerInputSchema,
  analyzeBusinessSources,
  taskAnalysisSchema,
} from "./taskAnalysis.js";

const source = { id: "description", text: "Нам нужен сервис для магазинов." };

function validAnalysis() {
  const emptyFact = { value: null, evidence: [] };
  const emptyDimension = { status: "missing", evidence: [] };
  return {
    extracted: {
      title: { value: "Сервис для магазинов", evidence: [{ sourceId: source.id, quote: "сервис для магазинов" }] },
      context: emptyFact,
      need: { value: "Сервис для магазинов", evidence: [{ sourceId: source.id, quote: "сервис для магазинов" }] },
      users: emptyFact,
      dataMaterials: emptyFact,
      expectedResult: emptyFact,
      successCriteria: emptyFact,
      constraints: emptyFact,
      contact: emptyFact,
      interactionFormat: emptyFact,
    },
    dimensions: {
      CONTEXT_AND_NEED: { status: "partial", evidence: [{ sourceId: source.id, quote: "сервис для магазинов" }] },
      DATA_AND_MATERIALS: emptyDimension,
      EXPECTED_RESULT: emptyDimension,
      SUCCESS_CRITERIA: emptyDimension,
      CONSTRAINTS: emptyDimension,
      USERS: emptyDimension,
      BUSINESS_CONNECTION: emptyDimension,
    },
    questions: [{
      question: "Кто будет пользоваться этим сервисом?",
      targetDimensions: ["USERS"],
      reason: "В исходном описании не указаны пользователи.",
    }],
  };
}

test("analysis input rejects descriptions too short to analyze", () => {
  assert.equal(analysisInputSchema.safeParse({ description: "коротко" }).success, false);
  assert.equal(analysisInputSchema.safeParse({ description: source.text }).success, true);
});

test("answer validation rejects empty clarification answers", () => {
  assert.equal(answerInputSchema.safeParse({ questionId: "q1", answer: " " }).success, false);
  assert.equal(answerInputSchema.safeParse({ questionId: "q1", answer: "Наша команда" }).success, true);
});

test("structured analysis schema accepts grounded facts and seven dimensions", () => {
  assert.equal(taskAnalysisSchema.safeParse(validAnalysis()).success, true);
});

test("analysis validates exact evidence quotes against user sources", async () => {
  const analysis = validAnalysis();
  analysis.extracted.need.evidence[0].quote = "администраторы сети";
  await assert.rejects(
    analyzeBusinessSources([source], [], { generateStructured: async () => analysis }),
    (error) => error instanceof AppError && error.code === "AI_UNGROUNDED_EVIDENCE",
  );
});

test("analysis returns at least three adaptive questions for multiple gaps", async () => {
  const result = await analyzeBusinessSources([source], [], {
    generateStructured: async () => validAnalysis(),
  });
  assert.ok(result.questions.length >= 3);
  assert.ok(result.questions.some(({ targetDimensions }) => targetDimensions.includes("USERS")));
  assert.ok(result.questions.every(({ targetDimensions }) => targetDimensions.length > 0));
});
