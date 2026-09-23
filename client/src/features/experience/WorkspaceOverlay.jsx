import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, ArrowUpRightIcon } from "@hugeicons/core-free-icons";
import { AnimatePresence, motion } from "motion/react";

const FIELD_ORDER = [
  "title",
  "context",
  "need",
  "users",
  "dataMaterials",
  "expectedResult",
  "successCriteria",
  "constraints",
  "contact",
  "interactionFormat",
];

const LEVEL_LABELS = {
  draft: "Начало пути",
  workable: "Уже понятнее",
  ready: "Почти готово",
  priority: "Готово к работе",
};

const GUIDANCE = {
  CONTEXT_AND_NEED: "Расскажите, что происходит сейчас и что хотелось бы изменить. Можно обычными словами, без технических терминов.",
  DATA_AND_MATERIALS: "Подойдут любые примеры: таблица, список, документ, фотография процесса или просто описание того, что уже есть.",
  EXPECTED_RESULT: "Опишите, что команда должна подготовить в итоге: идею, макет, прототип или работающий инструмент.",
  SUCCESS_CRITERIA: "Представьте, что задача выполнена. Что изменится или станет проще? Даже одного понятного признака достаточно.",
  CONSTRAINTS: "Вспомните важные сроки, правила доступа, ограничения или обязательные условия. Если их нет, так и напишите.",
  USERS: "Назовите людей или роли, для которых это делается. Например, сотрудники, посетители или конкретная рабочая команда.",
  BUSINESS_CONNECTION: "Подумайте, кто сможет отвечать на вопросы команды и как удобно получать обратную связь.",
};

function createConversationEvents(task) {
  const events = [
    {
      id: "initial-description",
      role: "user",
      kind: "description",
      content: task.description,
      createdAt: task.createdAt,
    },
  ];

  task.questions.forEach((question) => {
    if (question.status !== "answered" || !question.answer) return;
    events.push({
      id: `question-${question.id}`,
      role: "assistant",
      kind: "question",
      content: question.question,
      createdAt: question.createdAt,
    });
    events.push({
      id: `answer-${question.id}`,
      role: "user",
      kind: "answer",
      content: question.answer,
      createdAt: question.answeredAt || question.createdAt,
    });
  });

  task.messages.forEach((message) => events.push(message));
  return events.sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
}

function AnswerComposer({ question, isSaving, onAnswer, onSkip }) {
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    const content = message.trim();
    if (!content || isSaving) return;
    const result = await onAnswer(question.id, content);
    if (result) setMessage("");
  }

  return (
    <div className="next-question" ref={question.ref}>
      <div className="next-question-marker">
        <span className="question-orbit" aria-hidden="true" />
        СЛЕДУЮЩИЙ ШАГ
      </div>
      <h2>{question.question}</h2>
      <p className="question-guidance">
        {GUIDANCE[question.targetDimensions[0]] || "Ответьте так, как объяснили бы коллеге. Идеальная формулировка не нужна."}
      </p>
      <form className="conversation-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor={`reply-${question.id}`}>Ваш ответ</label>
        <textarea
          id={`reply-${question.id}`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Расскажите своими словами..."
          rows={3}
          maxLength={2000}
          disabled={isSaving}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="composer-footer">
          <span>Можно ответить коротко или задать свой вопрос</span>
          <div className="composer-actions">
            <button className="skip-question" type="button" onClick={() => onSkip(question.id)} disabled={isSaving}>
              Пропустить
            </button>
            <button className="send-answer" type="submit" disabled={isSaving || message.trim().length < 2}>
              <span>{isSaving ? "Сверяю ответ" : "Ответить"}</span>
              {isSaving ? <span className="answer-spinner" aria-hidden="true" /> : <HugeiconsIcon icon={ArrowUpRightIcon} size={18} strokeWidth={1.8} />}
            </button>
          </div>
        </div>
      </form>
      {isSaving && <p className="checking-answer" role="status">Проверяю, что ответ действительно помогает уточнить задачу…</p>}
    </div>
  );
}

function TaskEditor({ task, isSaving, onConfirm }) {
  const initialValues = useMemo(
    () => Object.fromEntries(task.fields.map(({ key, value }) => [key, value || ""])),
    [task.fields],
  );
  const [draftFields, setDraftFields] = useState(initialValues);

  useEffect(() => setDraftFields(initialValues), [initialValues]);

  async function save(event) {
    event.preventDefault();
    const fields = FIELD_ORDER
      .filter((key) => draftFields[key]?.trim())
      .map((key) => ({ key, value: draftFields[key].trim() }));
    if (fields.length) await onConfirm(fields);
  }

  return (
    <details className="task-editor">
      <summary>Посмотреть и поправить черновик карточки</summary>
      <form onSubmit={save}>
        {task.fields.map((field) => (
          <label className="task-editor-field" key={field.key} htmlFor={`edit-${field.key}`}>
            <span>{field.label}</span>
            <textarea
              id={`edit-${field.key}`}
              value={draftFields[field.key] || ""}
              onChange={(event) => setDraftFields((current) => ({ ...current, [field.key]: event.target.value }))}
              placeholder="Пока не указано"
              rows={field.key === "title" ? 1 : 2}
              maxLength={1000}
              disabled={isSaving}
            />
            {field.evidence[0]?.quote && <small>Из описания: «{field.evidence[0].quote}»</small>}
          </label>
        ))}
        <button className="save-task-card" type="submit" disabled={isSaving || !Object.values(draftFields).some((value) => value.trim())}>
          {isSaving ? "Сохраняю" : "Сохранить подтверждённые изменения"}
        </button>
      </form>
    </details>
  );
}

export default function WorkspaceOverlay({
  task,
  isSaving,
  error,
  achievement,
  onAnswer,
  onSkip,
  onConfirm,
  onReset,
}) {
  const activeQuestion = task.questions.find(({ status }) => status === "open");
  const events = useMemo(() => createConversationEvents(task), [task]);
  const questionRef = useRef(null);
  const endRef = useRef(null);
  const completedCount = task.questions.filter(({ status }) => status === "answered" || status === "skipped").length;
  const nextQuestionNumber = completedCount + 1;
  const nextImprovement = task.readiness.missing[0];
  const previousQuestionId = useRef(activeQuestion?.id || null);
  const previousMessageCount = useRef(task.messages.length);

  useEffect(() => {
    const questionChanged = previousQuestionId.current !== (activeQuestion?.id || null);
    const messagesChanged = previousMessageCount.current !== task.messages.length;
    if (questionChanged && previousQuestionId.current && activeQuestion) {
      questionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (messagesChanged) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    previousQuestionId.current = activeQuestion?.id || null;
    previousMessageCount.current = task.messages.length;
  }, [activeQuestion?.id, task.messages.length]);

  return (
    <motion.section
      className="workspace-overlay"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="conversation-shell">
        <div className="conversation-toolbar">
          <button className="conversation-back" type="button" onClick={onReset}>
            <HugeiconsIcon icon={ArrowLeft02Icon} size={18} strokeWidth={1.7} />
            Изменить описание
          </button>
          <span className="conversation-label">РАБОЧАЯ СЕССИЯ · {task.readiness.score} / 100</span>
        </div>

        <section className="readiness-hero" aria-label="Текущая полнота задачи">
          <div className="readiness-score-wrap">
            <p>ПОЛНОТА ЗАДАЧИ</p>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.strong
                className="readiness-score-value"
                key={task.readiness.score}
                initial={{ opacity: 0, y: 14, scale: 0.88 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 220, damping: 22 }}
              >
                {task.readiness.score}
              </motion.strong>
            </AnimatePresence>
            <span>/ 100</span>
          </div>
          <div className="readiness-copy">
            <motion.span
              className={`readiness-level readiness-level--${task.readiness.level}`}
              key={task.readiness.level}
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
            >
              <span aria-hidden="true" />{LEVEL_LABELS[task.readiness.level] || task.readiness.level}
            </motion.span>
            <h1>{activeQuestion ? "Соберём задачу вместе" : task.readiness.score === 100 ? "Задача готова к работе" : "Черновик уже собран"}</h1>
            <p>
              {activeQuestion
                ? `Каждый конкретный ответ помогает команде лучше понять ваш запрос. Сейчас уточнение ${nextQuestionNumber}.`
                : task.readiness.score === 100
                  ? "Все критерии описаны. Можно проверить итоговую карточку ниже."
                  : "Основное описание готово. Осталось уточнить детали, которые действительно важны."}
            </p>
            <div
              className="readiness-meter"
              role="progressbar"
              aria-label="Полнота задачи"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={task.readiness.score}
            >
              <motion.span
                key={`meter-${task.readiness.score}`}
                initial={{ width: 0 }}
                animate={{ width: `${task.readiness.score}%` }}
                transition={{ type: "spring", stiffness: 62, damping: 18, mass: 0.8 }}
              />
            </div>
            {nextImprovement && activeQuestion && (
              <p className="next-improvement">Сейчас полезнее всего: {nextImprovement.message}</p>
            )}
            <AnimatePresence>
              {achievement && (
                <motion.p
                  className="readiness-achievement"
                  key={achievement}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                >
                  ✦ {achievement}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <details className="dimension-details">
            <summary>Разбор оценки</summary>
            <div className="dimension-breakdown">
              {task.readiness.breakdown.map((dimension) => (
                <div className="dimension-row" key={dimension.dimension}>
                  <span>{dimension.label}</span>
                  <strong>{dimension.earned} / {dimension.maximum}</strong>
                </div>
              ))}
            </div>
          </details>
        </section>

        <section className="conversation-content" aria-label="Диалог по задаче">
          <header className="conversation-heading">
            <span>ВАША ЗАДАЧА</span>
            <p>Не нужно знать специальные термины. Расскажите так, как объяснили бы человеку из своей команды.</p>
          </header>

          <div className="conversation-events" aria-live="polite">
            {events.map((event) => (
              <motion.article
                className={`conversation-event conversation-event--${event.role} conversation-event--${event.kind}`}
                key={event.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
                <span className="event-label">
                  {event.role === "user"
                    ? event.kind === "description" ? "ВАШЕ ОПИСАНИЕ" : event.kind === "customer_question" ? "ВАШ ВОПРОС" : "ВАШ ОТВЕТ"
                    : event.kind === "customer_answer" ? "ОТВЕТ О ПРОЕКТЕ"
                      : event.kind === "clarification" ? "ПОПРОБУЕМ ИНАЧЕ"
                        : event.kind === "guidance" ? "ЧТО МОЖНО ДОБАВИТЬ"
                          : event.kind === "skip" ? "ДВИГАЕМСЯ ДАЛЬШЕ" : "BASPALDAQ"}
                </span>
                <p>{event.content}</p>
              </motion.article>
            ))}
          </div>

          {error && <div className="conversation-error" role="alert">{error}</div>}

          {activeQuestion ? (
            <AnswerComposer
              question={{ ...activeQuestion, ref: questionRef }}
              isSaving={isSaving}
              onAnswer={onAnswer}
              onSkip={onSkip}
            />
          ) : (
            <motion.div className="conversation-complete" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <span className="complete-spark" aria-hidden="true">✦</span>
              <h2>{task.readiness.score === 100 ? "Отличная работа. Всё на месте." : "Хороший старт. Остальное можно добавить позже."}</h2>
              <p>{task.readiness.score === 100 ? "Описание можно передавать команде." : "Пропущенные пункты отмечены в разборе оценки, ничего не потеряется."}</p>
            </motion.div>
          )}
          <div ref={endRef} />
        </section>

        <TaskEditor task={task} isSaving={isSaving} onConfirm={onConfirm} />
      </div>
    </motion.section>
  );
}
