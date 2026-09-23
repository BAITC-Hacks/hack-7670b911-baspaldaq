import { HugeiconsIcon } from "@hugeicons/react";
import { VolumeHighIcon, VolumeOffIcon } from "@hugeicons/core-free-icons";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

export default function ExperienceHeader({
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

      <nav className="experience-nav" aria-label="Выбор роли"><Link to="/business/new">Для бизнеса</Link><Link to="/catalog">Для команды</Link></nav>

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
