import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Howl } from "howler";
import ExperienceHeader from "./ExperienceHeader.jsx";
import TaskInput from "./TaskInput.jsx";
import WorkspaceOverlay from "./WorkspaceOverlay.jsx";
import { analyzeTask, answerTaskQuestion, confirmTaskFields } from "../../lib/tasksApi.js";

const SpaceScene = lazy(() => import("./SpaceScene.jsx"));

export default function BaspaldaqExperience() {
  const [phase, setPhase] = useState("entry");
  const [milestone, setMilestone] = useState("ready");
  const [taskIdea, setTaskIdea] = useState("");
  const [draftIdea, setDraftIdea] = useState("");
  const [task, setTask] = useState(null);
  const [requestError, setRequestError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [flightArrived, setFlightArrived] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sceneKey, setSceneKey] = useState(0);
  const soundRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    soundRef.current = new Howl({
      src: ["/launch.mp3"],
      volume: 0.64,
      preload: true,
      html5: true,
    });

    return () => {
      soundRef.current?.unload();
      soundRef.current = null;
    };
  }, []);

  const finishFlight = useCallback(() => {
    setFlightArrived(true);

    if (soundRef.current?.playing()) {
      soundRef.current.fade(soundRef.current.volume(), 0.08, 900);
    }
  }, []);

  useEffect(() => {
    if (phase === "flight" && flightArrived && task && !isAnalyzing) {
      setPhase("arrived");
      setMilestone("system");
    }
  }, [flightArrived, isAnalyzing, phase, task]);

  async function handleSubmit(idea) {
    const normalizedIdea = idea.trim();
    setTaskIdea(normalizedIdea);
    setDraftIdea(normalizedIdea);
    setRequestError("");
    setTaskError("");
    setTask(null);
    setFlightArrived(false);
    setIsAnalyzing(true);
    setMilestone("descent");
    setPhase("flight");

    if (soundEnabled && !shouldReduceMotion) {
      soundRef.current?.stop();
      soundRef.current?.volume(0.64);
      soundRef.current?.play();
    }

    try {
      const analyzedTask = await analyzeTask(normalizedIdea);
      setTask(analyzedTask);
    } catch (error) {
      soundRef.current?.stop();
      setRequestError(error.message);
      setPhase("entry");
      setFlightArrived(false);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleReset() {
    soundRef.current?.stop();
    setPhase("entry");
    setMilestone("ready");
    setTaskIdea("");
    setDraftIdea("");
    setTask(null);
    setRequestError("");
    setTaskError("");
    setFlightArrived(false);
    setIsAnalyzing(false);
    setIsSaving(false);
    setSceneKey((value) => value + 1);
    window.requestAnimationFrame(() => document.getElementById("task-idea")?.focus());
  }

  async function runTaskUpdate(update) {
    if (!task?.id) return;
    setIsSaving(true);
    setTaskError("");
    try {
      setTask(await update(task.id));
      return true;
    } catch (error) {
      setTaskError(error.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function handleAnswer(questionId, answer) {
    return runTaskUpdate((taskId) => answerTaskQuestion(taskId, questionId, answer));
  }

  function handleConfirm(fields) {
    return runTaskUpdate((taskId) => confirmTaskFields(taskId, fields));
  }

  return (
    <div className={`experience phase-${phase}`}>
      <a className="skip-link" href="#experience-main">
        Перейти к содержимому
      </a>

      <div className="space-fallback" aria-hidden="true" />
      <Suspense fallback={null}>
        <SpaceScene
          key={sceneKey}
          phase={phase}
          reducedMotion={Boolean(shouldReduceMotion)}
          rocketVisible={phase !== "entry"}
          onArrive={finishFlight}
          onMilestone={setMilestone}
        />
      </Suspense>

      <ExperienceHeader
        phase={phase}
        milestone={milestone}
        soundEnabled={soundEnabled}
        onSoundToggle={() => setSoundEnabled((value) => !value)}
        onReset={handleReset}
      />

      <main id="experience-main" className="experience-main">
        <AnimatePresence>
          {phase === "entry" && (
            <motion.section
              className="entry-layer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -80, filter: "blur(10px)" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="entry-index" aria-hidden="true">
                01
              </div>
              <div className="entry-heading">
                <p className="section-kicker">Новая практическая задача</p>
                <h1>
                  Начните с того,
                  <br />
                  что пока <em>неясно.</em>
                </h1>
                <p>
                  Одно честное описание. Дальше Baspaldaq соберёт контекст,
                  ограничения и критерии результата.
                </p>
              </div>

              <TaskInput
                onSubmit={handleSubmit}
                initialValue={draftIdea}
                requestError={requestError}
              />

              <div className="entry-caption">
                <span>AI не добавляет факты за вас</span>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "flight" && (
            <motion.div
              className="flight-hud"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="flight-hud-label">
                {isAnalyzing
                  ? "Анализируем описание"
                  : milestone === "turn"
                    ? "Манёвр к системе"
                    : "Спуск к структуре"}
              </span>
              <span className="flight-line" aria-hidden="true" />
              <span className="flight-hud-idea">{taskIdea}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "arrived" && (
              <WorkspaceOverlay
                task={task}
                isSaving={isSaving}
                error={taskError}
                onAnswer={handleAnswer}
                onConfirm={handleConfirm}
                onReset={handleReset}
              />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
