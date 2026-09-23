import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import ExperienceHeader from "./ExperienceHeader.jsx";
import TaskInput from "./TaskInput.jsx";
import WorkspaceOverlay from "./WorkspaceOverlay.jsx";
import { analyzeTask, answerTaskQuestion, confirmTaskFields, skipTaskQuestion } from "../../lib/tasksApi.js";
import { createExperienceAudio } from "../../lib/experienceAudio.js";
import { useNavigate, useParams } from "react-router-dom";
import { getTask } from "../../lib/tasksApi.js";

const SpaceScene = lazy(() => import("./SpaceScene.jsx"));

const LEVEL_TITLES = {
  draft: "Начало пути",
  workable: "Уже понятнее",
  ready: "Почти готово",
  priority: "Готово к работе",
};

export default function BaspaldaqExperience() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [phase, setPhase] = useState("entry");
  const [milestone, setMilestone] = useState("ready");
  const [taskIdea, setTaskIdea] = useState("");
  const [draftIdea, setDraftIdea] = useState("");
  const [task, setTask] = useState(null);
  const [requestError, setRequestError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [scoreNotice, setScoreNotice] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [flightArrived, setFlightArrived] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sceneKey, setSceneKey] = useState(0);
  const audioRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    audioRef.current = createExperienceAudio();

    return () => {
      audioRef.current?.unload();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioRef.current?.setMuted(!soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (!taskId) return undefined;
    let active = true;
    getTask(taskId).then((loaded) => {
      if (!active) return;
      setTask(loaded);
      setPhase("arrived");
      setIsAnalyzing(false);
    }).catch((error) => {
      if (active) setTaskError(error.message);
    });
    return () => { active = false; };
  }, [taskId]);

  const finishFlight = useCallback(() => {
    setFlightArrived(true);

    audioRef.current?.fadeLaunch();
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
    setScoreNotice("");
    setTask(null);
    setFlightArrived(false);
    setIsAnalyzing(true);
    setMilestone("descent");
    setPhase("flight");

    if (soundEnabled && !shouldReduceMotion) {
      audioRef.current?.play("launch");
    }

    try {
      const analyzedTask = await analyzeTask(normalizedIdea);
      setTask(analyzedTask);
      window.localStorage.setItem("baspaldaq:last-task", analyzedTask.id);
    } catch (error) {
      audioRef.current?.stop();
      setRequestError(error.message);
      setPhase("entry");
      setFlightArrived(false);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleReset() {
    navigate("/business/new");
    audioRef.current?.stop();
    setPhase("entry");
    setMilestone("ready");
    setTaskIdea("");
    setDraftIdea("");
    setTask(null);
    setRequestError("");
    setTaskError("");
    setScoreNotice("");
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
      const result = await update(task.id);
      if (!result?.task) throw new Error("Сервер не вернул обновлённую задачу.");
      setTask(result.task);
      if (result.outcome?.type === "accepted") {
        const delta = result.outcome.scoreDelta || 0;
        const levelChanged = result.task.level !== task.level;
        setScoreNotice(levelChanged
          ? `Новый уровень: ${LEVEL_TITLES[result.task.readiness.level]}`
          : delta > 0 ? `+${delta} к полноте задачи` : "Ответ добавлен в описание задачи");
        window.setTimeout(() => setScoreNotice(""), 3200);
      }
      if (soundEnabled) {
        if (result.outcome?.type === "accepted") {
          audioRef.current?.play("answer");
          const hasOpenQuestions = result.task.questions.some(({ status }) => status === "open");
          audioRef.current?.play(!hasOpenQuestions ? "complete" : result.task.level !== task.level ? "levelUp" : "accepted");
        } else if (result.outcome?.type === "customer_question") {
          audioRef.current?.play("customerQuestion");
        } else if (result.outcome?.type === "retry") {
          audioRef.current?.play("retry");
        } else if (result.outcome?.type === "skipped") {
          audioRef.current?.play("skipped");
        }
      }
      return result;
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

  function handleSkip(questionId) {
    return runTaskUpdate((taskId) => skipTaskQuestion(taskId, questionId));
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
          {phase === "arrived" && task && (
              <WorkspaceOverlay
                task={task}
                isSaving={isSaving}
                error={taskError}
                achievement={scoreNotice}
                onAnswer={handleAnswer}
                onSkip={handleSkip}
                onConfirm={handleConfirm}
                onReset={handleReset}
              />
          )}
        </AnimatePresence>
        {taskError && !task && <div className="load-error" role="alert">{taskError}</div>}
      </main>
    </div>
  );
}
