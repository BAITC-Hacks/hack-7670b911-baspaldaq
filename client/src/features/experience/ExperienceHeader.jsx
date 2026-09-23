import { HugeiconsIcon } from "@hugeicons/react";
import { VolumeHighIcon, VolumeOffIcon } from "@hugeicons/core-free-icons";
import { motion } from "motion/react";

const MILESTONE_LABELS = {
  ready: "Ввод",
  descent: "Спуск",
  turn: "Поворот",
  system: "Система задачи",
};

export default function ExperienceHeader({
  phase,
  milestone,
  soundEnabled,
  onSoundToggle,
  onReset,
}) {
  return (
    <motion.header
      className="experience-header"
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        className="experience-brand"
        type="button"
        onClick={onReset}
        aria-label="Baspaldaq, начать новую задачу"
      >
        <img
          className="brand-wordmark"
          src="/brand/baspladaq-wordmark.png"
          alt=""
          draggable="false"
        />
      </button>

      <div className="journey-status" aria-live="polite">
        <span className="journey-number">
          {phase === "entry" ? "01" : phase === "flight" ? "02" : "03"}
        </span>
        <span>{MILESTONE_LABELS[milestone]}</span>
      </div>

      <button
        className="sound-toggle"
        type="button"
        onClick={onSoundToggle}
        aria-pressed={soundEnabled}
        aria-label={soundEnabled ? "Выключить звуковые эффекты" : "Включить звуковые эффекты"}
        title={soundEnabled ? "Выключить звук" : "Включить звук"}
      >
        <HugeiconsIcon
          icon={soundEnabled ? VolumeHighIcon : VolumeOffIcon}
          size={18}
          strokeWidth={1.6}
        />
      </button>
    </motion.header>
  );
}
