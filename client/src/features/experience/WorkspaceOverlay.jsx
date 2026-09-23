import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { motion } from "motion/react";

export default function WorkspaceOverlay({ idea, onReset }) {
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
        initial={{ x: -120, opacity: 0, rotate: -4 }}
        animate={{ x: 0, opacity: 1, rotate: -1.5 }}
        transition={{ type: "spring", stiffness: 75, damping: 18, delay: 0.22 }}
      >
        <div className="stack-shadow stack-shadow-one" aria-hidden="true" />
        <div className="stack-shadow stack-shadow-two" aria-hidden="true" />
        <article className="task-sheet">
          <div className="sheet-topline">
            <span>Черновик задачи</span>
            <span>01 / 07</span>
          </div>
          <p className="sheet-label">Исходная идея</p>
          <h1>{idea}</h1>
          <div className="sheet-readiness">
            <strong>0</strong>
            <span>/ 7 подтверждено</span>
          </div>
          <div className="sheet-scale" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        </article>
        <motion.div
          className="lime-note"
          initial={{ x: -30, y: 30, opacity: 0, rotate: 3 }}
          animate={{ x: 0, y: 0, opacity: 1, rotate: 2 }}
          transition={{ delay: 0.72, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <span>Дальше</span>
          <strong>Уточнить недостающие данные</strong>
        </motion.div>
      </motion.div>

      <div className="system-copy">
        <p>Система готовности</p>
        <h2>Задача стала центром.</h2>
        <span>Планеты показывают, что ещё нужно подтвердить.</span>
      </div>

      <button className="workspace-back" type="button" onClick={onReset}>
        <HugeiconsIcon icon={ArrowLeft02Icon} size={18} strokeWidth={1.7} />
        Изменить описание
      </button>
    </motion.section>
  );
}
