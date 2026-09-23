import { useRef } from "react";
import { useForm } from "react-hook-form";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { motion } from "motion/react";

const MIN_LENGTH = 12;

export default function TaskInput({ onSubmit, initialValue, requestError }) {
  const textareaRef = useRef(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ defaultValues: { idea: initialValue || "" } });
  const idea = watch("idea");
  const { ref, ...ideaField } = register("idea", {
    required: "Опишите задачу одним предложением",
    minLength: {
      value: MIN_LENGTH,
      message: "Добавьте немного контекста — минимум 12 символов",
    },
    onChange: (event) => resizeTextarea(event.currentTarget),
  });

  function resizeTextarea(element) {
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 136)}px`;
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <motion.form
      className="thin-composer"
      onSubmit={handleSubmit(({ idea: value }) => onSubmit(value))}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      noValidate
    >
      <label className="sr-only" htmlFor="task-idea">
        Опишите задачу или проблему бизнеса
      </label>
      <textarea
        id="task-idea"
        rows="1"
        placeholder="Что в бизнесе нужно изменить или понять?"
        aria-invalid={Boolean(errors.idea)}
        aria-describedby={errors.idea ? "task-error" : undefined}
        onKeyDown={handleKeyDown}
        {...ideaField}
        ref={(element) => {
          ref(element);
          textareaRef.current = element;
        }}
      />
      <motion.button
        type="submit"
        className="composer-launch"
        disabled={idea.trim().length < MIN_LENGTH}
        whileHover={idea.trim().length >= MIN_LENGTH ? { scale: 1.06, y: -1 } : undefined}
        whileTap={idea.trim() ? { scale: 0.94 } : undefined}
        aria-label="Запустить формирование задачи"
        title="Запустить"
      >
        <HugeiconsIcon icon={ArrowUp02Icon} size={22} strokeWidth={2} />
      </motion.button>
      {errors.idea && (
        <span className="composer-error" id="task-error" role="alert">
          {errors.idea.message}
        </span>
      )}
      {requestError && (
        <span className="composer-error" role="alert">
          {requestError}
        </span>
      )}
    </motion.form>
  );
}
