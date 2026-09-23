import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { motion } from "motion/react";

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

function AnswerForm({ question, isSaving, onAnswer }) {
  const [answer, setAnswer] = useState("");

  async function submit(event) {
    event.preventDefault();
    const value = answer.trim();
    if (!value || isSaving) return;
    if (await onAnswer(question.id, value)) setAnswer("");
  }

  return (
    <form className="clarification-form" onSubmit={submit}>
      <label className="sr-only" htmlFor={`answer-${question.id}`}>
        Ответ на вопрос: {question.question}
      </label>
      <textarea
        id={`answer-${question.id}`}
        rows="2"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Ваш ответ"
        maxLength={2000}
        disabled={isSaving}
      />
      <button type="submit" disabled={isSaving || answer.trim().length < 2}>
        {isSaving ? "Анализируем" : "Ответить"}
      </button>
    </form>
  );
}

export default function WorkspaceOverlay({
  task,
  isSaving,
  error,
  onAnswer,
  onConfirm,
  onReset,
}) {
  const initialValues = useMemo(
    () => Object.fromEntries(task.fields.map(({ key, value }) => [key, value || ""])),
    [task.fields],
  );
  const [draftFields, setDraftFields] = useState(initialValues);
  const [selectedFields, setSelectedFields] = useState(() => new Set(
    task.fields.filter(({ value, status }) => value && status !== "confirmed").map(({ key }) => key),
  ));

  useEffect(() => {
    setDraftFields(initialValues);
    setSelectedFields(new Set(
      task.fields.filter(({ value, status }) => value && status !== "confirmed").map(({ key }) => key),
    ));
  }, [initialValues, task.fields]);

  const activeQuestions = task.questions.filter(({ status }) => status === "open");
  const confirmedCount = task.fields.filter(({ status, value }) => status === "confirmed" && value).length;
  const taskTitle = draftFields.title?.trim() || task.description;
  const recommendation = task.readiness.missing[0];

  function updateField(key, value) {
    setDraftFields((current) => ({ ...current, [key]: value }));
    setSelectedFields((current) => new Set(current).add(key));
  }

  function toggleField(key) {
    setSelectedFields((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function confirmSelected(event) {
    event.preventDefault();
    const fields = FIELD_ORDER
      .filter((key) => selectedFields.has(key) && draftFields[key]?.trim())
      .map((key) => ({ key, value: draftFields[key].trim() }));
    if (fields.length) await onConfirm(fields);
  }

  return (
    <motion.section
      className="workspace-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div
        className="workspace-divider"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
      />

      <motion.div
        className="task-stack"
        initial={{ x: -90, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 75, damping: 18, delay: 0.22 }}
      >
        <div className="stack-shadow stack-shadow-one" aria-hidden="true" />
        <div className="stack-shadow stack-shadow-two" aria-hidden="true" />
        <article className="task-sheet">
          <div className="sheet-topline">
            <span>Карточка задачи</span>
            <span>{String(confirmedCount).padStart(2, "0")} / 10</span>
          </div>
          <p className="sheet-label">Подтверждённые факты</p>
          <h1>{taskTitle}</h1>
          <div className="sheet-readiness">
            <strong>{task.readiness.score}</strong>
            <span>/ 100 · {task.readiness.level}</span>
          </div>
          <div className="sheet-scale" aria-label={`Готовность ${task.readiness.score} из 100`}>
            {task.readiness.breakdown.map((dimension) => (
              <span
                key={dimension.dimension}
                className={`is-${dimension.status}`}
                title={`${dimension.label}: ${dimension.earned} из ${dimension.maximum}`}
              />
            ))}
          </div>
          <form className="task-fields" onSubmit={confirmSelected}>
            {FIELD_ORDER.map((key) => {
              const field = task.fields.find((item) => item.key === key);
              if (!field) return null;
              const evidence = field.evidence[0]?.quote;

              return (
                <div className="task-field" key={key}>
                  <div className="task-field-heading">
                    <label htmlFor={`field-${key}`}>{field.label}</label>
                    <label className="field-confirm-toggle">
                      <input
                        type="checkbox"
                        checked={selectedFields.has(key)}
                        onChange={() => toggleField(key)}
                        aria-label={`Подтвердить поле «${field.label}»`}
                      />
                      <span>{field.status === "confirmed" ? "Подтверждено" : "Подтвердить"}</span>
                    </label>
                  </div>
                  <textarea
                    id={`field-${key}`}
                    rows={key === "title" ? 1 : 2}
                    value={draftFields[key] || ""}
                    onChange={(event) => updateField(key, event.target.value)}
                    placeholder="Пока не указано"
                    maxLength={1000}
                    disabled={isSaving}
                  />
                  {evidence && field.provenance !== "manual_edit" && (
                    <small className="field-evidence">Источник: «{evidence}»</small>
                  )}
                </div>
              );
            })}
            <button
              className="field-save"
              type="submit"
              disabled={isSaving || ![...selectedFields].some((key) => draftFields[key]?.trim())}
            >
              {isSaving ? "Сохраняем" : "Подтвердить выбранные поля"}
            </button>
          </form>
        </article>
        <motion.div
          className="lime-note"
          initial={{ x: -30, y: 30, opacity: 0, rotate: 3 }}
          animate={{ x: 0, y: 0, opacity: 1, rotate: 2 }}
          transition={{ delay: 0.72, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <span>{recommendation ? `Потенциал +${recommendation.potentialGain}` : "Готовность"}</span>
          <strong>{recommendation?.message || "Все критерии подтверждены"}</strong>
        </motion.div>
      </motion.div>

      <div className="system-copy">
        <p>Система готовности · {task.readiness.score} / 100</p>
        <h2>{task.readiness.level === "draft" ? "Уточним задачу." : "Карточка обновлена."}</h2>
        <span>Подтвердите извлечённые факты и дополните то, чего пока не хватает.</span>
        {error && <div className="task-error" role="alert">{error}</div>}

        <div className="dimension-breakdown">
          {task.readiness.breakdown.map((dimension) => (
            <div className="dimension-row" key={dimension.dimension}>
              <span>{dimension.label}</span>
              <strong>{dimension.earned} / {dimension.maximum}</strong>
            </div>
          ))}
        </div>

        <div className="clarification-list">
          <p>Уточняющие вопросы</p>
          {activeQuestions.length ? activeQuestions.map((question, index) => (
            <section className="clarification-item" key={question.id}>
              <h3><span>{String(index + 1).padStart(2, "0")}</span>{question.question}</h3>
              <AnswerForm question={question} isSaving={isSaving} onAnswer={onAnswer} />
            </section>
          )) : (
            <p className="questions-complete">
              Новых вопросов нет. При необходимости дополните карточку и подтвердите изменения.
            </p>
          )}
        </div>
      </div>

      <button className="workspace-back" type="button" onClick={onReset}>
        <HugeiconsIcon icon={ArrowLeft02Icon} size={18} strokeWidth={1.7} />
        Изменить описание
      </button>
    </motion.section>
  );
}
