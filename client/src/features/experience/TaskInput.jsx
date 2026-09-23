import { useRef } from "react";
import { useForm } from "react-hook-form";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight02Icon } from "@hugeicons/core-free-icons";
import { motion } from "motion/react";

const MIN_LENGTH = 12;

export default function TaskInput({ onSubmit }) {
  const textareaRef = useRef(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ defaultValues: { idea: "" } });
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
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
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
      <span className="composer-index" aria-hidden="true">
        Ввод
      </span>
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
        disabled={!idea.trim()}
        whileHover={idea.trim() ? { scale: 1.06, rotate: 4 } : undefined}
        whileTap={idea.trim() ? { scale: 0.94 } : undefined}
        aria-label="Запустить формирование задачи"
        title="Запустить"
      >
        <HugeiconsIcon icon={ArrowUpRight02Icon} size={21} strokeWidth={1.8} />
      </motion.button>
      {errors.idea && (
        <span className="composer-error" id="task-error" role="alert">
          {errors.idea.message}
        </span>
      )}
    </motion.form>
  );
}
