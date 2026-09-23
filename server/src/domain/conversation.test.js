import test from "node:test";
import assert from "node:assert/strict";
import {
  assessConversationReply,
  conversationInputSchema,
  replyAssessmentSchema,
} from "./conversation.js";

const question = {
  question: "Кто будет пользоваться этим решением?",
  targetDimensions: '["USERS"]',
};

function answerAssessment(overrides = {}) {
  return {
    kind: "answer",
    sufficient: true,
    coveredDimensions: ["USERS"],
    reply: "Спасибо, теперь понятнее.",
    rephrasedQuestion: null,
    guidance: null,
    ...overrides,
  };
}

test("conversation accepts a message or an explicit skip without requiring both", () => {
  assert.equal(conversationInputSchema.safeParse({ questionId: "q1", message: "Наша команда" }).success, true);
  assert.equal(conversationInputSchema.safeParse({ questionId: "q1", answer: "Наша команда" }).success, true);
  assert.equal(conversationInputSchema.safeParse({ questionId: "q1", skip: true }).success, true);
  assert.equal(conversationInputSchema.safeParse({ questionId: "q1", message: " " }).success, false);
  assert.equal(conversationInputSchema.safeParse({ questionId: "q1", skip: false }).success, false);
});

test("reply assessment receives the live question and validates the structured AI response", async () => {
  const input = { question: question.question, targetDimensions: ["USERS"], message: "Менеджеры магазинов", description: "Сервис для магазинов" };
  const result = await assessConversationReply(question, input.message, input.description, {
    generateStructured: async (received) => {
      assert.deepEqual(received, input);
      return answerAssessment();
    },
  });
  assert.deepEqual(result.coveredDimensions, ["USERS"]);
  assert.equal(replyAssessmentSchema.safeParse(result).success, true);
});

test("customer questions can be answered separately without claiming task facts", async () => {
  const result = await assessConversationReply(question, "Сколько это стоит?", "Нужен сервис для магазинов", {
    generateStructured: async () => answerAssessment({
      kind: "customer_question",
      sufficient: false,
      coveredDimensions: [],
      reply: "В описании стоимость не указана.",
      guidance: null,
    }),
  });
  assert.equal(result.kind, "customer_question");
  assert.equal(result.coveredDimensions.length, 0);
});

test("unclear answers include a rephrased question and a practical hint", async () => {
  const result = await assessConversationReply(question, "Не знаю", "Сервис для магазинов", {
    generateStructured: async () => answerAssessment({
      kind: "unclear",
      sufficient: false,
      coveredDimensions: [],
      reply: "Можно ответить проще.",
      rephrasedQuestion: "Кто чаще всего будет открывать этот сервис в течение дня?",
      guidance: "Можно назвать должность или группу людей.",
    }),
  });
  assert.equal(result.kind, "unclear");
  assert.match(result.rephrasedQuestion, /кто чаще всего/i);
});
