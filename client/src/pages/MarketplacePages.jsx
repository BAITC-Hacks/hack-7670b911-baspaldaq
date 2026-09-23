import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  confirmMilestone, confirmTask, createMilestone, createTeam, decideProposal,
  getTask, getTeam, listMilestones, listProposals, listTasks, publishTask,
  saveTaskCard, submitProposal, updateTeam,
} from "../lib/tasksApi.js";

const STATUS = { DRAFT: "Черновик", CLARIFYING: "Уточнение", CONFIRMED: "Подтверждена", PUBLISHED: "Опубликована" };
const LEVEL = { draft: "Черновик", workable: "Рабочая", ready: "Готова", priority: "Приоритет" };
const FIELD_KEYS = ["title", "context", "need", "users", "dataMaterials", "constraints", "expectedResult", "successCriteria", "contact", "interactionFormat"];
const FIELD_LABELS = { title: "Название", context: "Контекст", need: "Потребность", users: "Пользователи", dataMaterials: "Данные и материалы", constraints: "Ограничения", expectedResult: "Ожидаемый результат", successCriteria: "Критерии успеха", contact: "Контакт", interactionFormat: "Формат взаимодействия" };

function PageFrame({ eyebrow, title, children, actions }) {
  return (
    <div className="market-page">
      <header className="market-header">
        <Link className="market-brand" to="/business/new" aria-label="Baspaldaq, новая задача"><img src="/brand/baspladaq-wordmark.png" alt="Baspaldaq" /></Link>
        <nav aria-label="Навигация">
          <Link to="/business/new">Новая задача</Link>
          <Link to="/business">Мои задачи</Link>
          <Link to="/catalog">Каталог</Link>
          <Link to="/team">Команда</Link>
        </nav>
      </header>
      <main className="market-main">
        <div className="market-title-row"><div><p className="market-eyebrow">{eyebrow}</p><h1>{title}</h1></div>{actions}</div>
        {children}
      </main>
    </div>
  );
}

function QueryState({ query, children }) {
  if (query.isPending) return <p className="market-state" role="status">Загружаем данные…</p>;
  if (query.isError) return <p className="market-error" role="alert">{query.error.message}</p>;
  return children(query.data);
}

function useTask(taskId) {
  return useQuery({ queryKey: ["task", taskId], queryFn: () => getTask(taskId) });
}

function ScoreBreakdown({ task }) {
  return (
    <section className="market-score" aria-label="Оценка полноты">
      <div><span>ПОЛНОТА ЗАДАЧИ</span><motion.strong key={task.score} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>{task.score}<small>/100</small></motion.strong><p>{LEVEL[task.level]}</p></div>
      <details><summary>Разбор оценки</summary><div className="market-score-list">{task.readiness.breakdown.map((item) => <div key={item.dimension}><span>{item.label}</span><strong>{item.earned}/{item.maximum}</strong>{item.status !== "complete" && <small>{task.readiness.missing.find(({ dimension }) => dimension === item.dimension)?.message} Потенциал +{item.maximum - item.earned}</small>}</div>)}</div></details>
    </section>
  );
}

function TaskFields({ task }) {
  return <div className="market-fields">{FIELD_KEYS.filter((key) => key !== "title").map((key) => {
    const field = task.fields.find((item) => item.key === key);
    return <section key={key}><h2>{field?.label || FIELD_LABELS[key]}</h2><p>{field?.value || "Не указано"}</p></section>;
  })}</div>;
}

export function BusinessTasksPage() {
  const query = useQuery({ queryKey: ["business-tasks"], queryFn: async () => [...await listTasks({ published: "false" }), ...await listTasks({ published: "true" })] });
  return <PageFrame eyebrow="Бизнес" title="Задачи" actions={<Link className="market-button market-button--accent" to="/business/new">Создать задачу</Link>}><QueryState query={query}>{(tasks) => tasks.length ? <div className="market-list">{tasks.map((task) => <article className="market-list-item" key={task.id}><div><span className="market-meta">{STATUS[task.status]} · {task.score}/100</span><h2>{task.title}</h2><p>{task.need}</p></div><div className="market-row-actions"><Link to={`/business/tasks/${task.id}/review`}>Карточка ↗</Link>{task.status === "PUBLISHED" && <Link to={`/business/tasks/${task.id}/proposals`}>Предложения ({task.proposalCount}) ↗</Link>}</div></article>)}</div> : <p className="market-state">Пока нет задач. Начните с описания бизнес-ситуации.</p>}</QueryState></PageFrame>;
}

export function TaskReviewPage() {
  const { taskId } = useParams();
  const query = useTask(taskId);
  const queryClient = useQueryClient();
  const [values, setValues] = useState({});
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!query.data) return;
    setValues(Object.fromEntries(query.data.fields.map(({ key, value }) => [key, value || ""])));
    setTopic(query.data.topic || "");
  }, [query.data]);

  async function act(name, action) {
    setBusy(name); setError(""); setNotice("");
    try {
      const task = await action();
      queryClient.setQueryData(["task", taskId], task);
      queryClient.invalidateQueries({ queryKey: ["business-tasks"] });
      setNotice(name === "save" ? "Изменения сохранены. Оценка пересчитана." : name === "confirm" ? "Карточка подтверждена вами." : "Задача опубликована в каталоге.");
    } catch (failure) { setError(failure.message); }
    finally { setBusy(""); }
  }

  return <PageFrame eyebrow="Бизнес / карточка задачи" title={query.data?.fields.find(({ key }) => key === "title")?.value || "Проверка задачи"} actions={<Link className="market-text-link" to={`/business/tasks/${taskId}`}>Вернуться к уточнению ↗</Link>}><QueryState query={query}>{(task) => <>
    <div className="market-review-intro"><span className="market-meta">{STATUS[task.status]}</span><p>{task.status === "PUBLISHED" ? "Карточка опубликована и доступна командам в каталоге." : "Проверьте факты, отредактируйте карточку и подтвердите её перед публикацией. Пустые пункты можно оставить на потом."}</p></div>
    <ScoreBreakdown task={task} />
    {task.status === "PUBLISHED" ? <TaskFields task={task} /> : <form className="market-edit-form" onSubmit={(event) => { event.preventDefault(); act("save", () => saveTaskCard(taskId, FIELD_KEYS.map((key) => ({ key, value: values[key] || "" })), topic || null)); }}>
      <label className="market-field market-field--wide"><span>Тема каталога</span><input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={80} placeholder="Например, производство" disabled={Boolean(busy) || task.status === "PUBLISHED"} /></label>
      {FIELD_KEYS.map((key) => { const field = task.fields.find((item) => item.key === key); return <label className={`market-field ${["context", "need", "expectedResult"].includes(key) ? "market-field--wide" : ""}`} key={key}><span>{field?.label || FIELD_LABELS[key]}</span><textarea value={values[key] || ""} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} rows={key === "title" ? 2 : 4} maxLength={1000} disabled={Boolean(busy)} placeholder="Не указано" />{field?.evidence?.[0]?.quote && field.provenance !== "manual_edit" && <small>Источник: «{field.evidence[0].quote}»</small>}</label>; })}
      {task.status !== "PUBLISHED" && <div className="market-form-actions"><button className="market-button" type="submit" disabled={Boolean(busy)}>{busy === "save" ? "Сохраняем…" : "Сохранить изменения"}</button><button className="market-button" type="button" disabled={Boolean(busy) || task.status === "CONFIRMED"} onClick={() => act("confirm", () => confirmTask(taskId))}>{busy === "confirm" ? "Подтверждаем…" : "Подтвердить карточку"}</button><button className="market-button market-button--accent" type="button" disabled={Boolean(busy) || task.status !== "CONFIRMED"} onClick={() => act("publish", () => publishTask(taskId))}>{busy === "publish" ? "Публикуем…" : "Опубликовать"}</button></div>}
    </form>}
    {error && <p className="market-error" role="alert">{error}</p>}{notice && <p className="market-success" role="status">{notice}</p>}
    {task.status === "PUBLISHED" && <div className="market-form-actions"><Link className="market-button" to={`/tasks/${task.id}`}>Посмотреть в каталоге</Link><Link className="market-button market-button--accent" to={`/business/tasks/${task.id}/proposals`}>Предложения команд</Link></div>}
  </>}</QueryState></PageFrame>;
}

export function CatalogPage() {
  const [level, setLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [sort, setSort] = useState("score_desc");
  const query = useQuery({ queryKey: ["catalog", level, topic, sort], queryFn: () => listTasks({ published: "true", readiness: level, topic, sort }) });
  return <PageFrame eyebrow="Команды / открытые задачи" title="Каталог задач" actions={<Link className="market-text-link" to="/team">Профиль команды ↗</Link>}><div className="market-filters"><label>Уровень<select value={level} onChange={(event) => setLevel(event.target.value)}><option value="">Все уровни</option>{Object.entries(LEVEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Тема<input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Все темы" maxLength={80} /></label><label>Сортировка<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="score_desc">По полноте ↓</option><option value="score_asc">По полноте ↑</option><option value="newest">Новые сначала</option></select></label></div><QueryState query={query}>{(tasks) => tasks.length ? <div className="catalog-grid">{tasks.map((task) => <motion.article layout className="catalog-item" key={task.id}><div className="catalog-top"><span>{task.topic || "Без темы"}</span><strong>{task.score}<small>/100</small></strong></div><h2>{task.title}</h2><p>{task.need}</p><div className="catalog-bottom"><span>{LEVEL[task.level]}</span><Link to={`/tasks/${task.id}`}>Открыть задачу ↗</Link></div></motion.article>)}</div> : <p className="market-state">По этим фильтрам задач пока нет. Попробуйте другой уровень или тему.</p>}</QueryState></PageFrame>;
}

export function TaskDetailsPage() {
  const { taskId } = useParams(); const query = useTask(taskId);
  return <PageFrame eyebrow="Каталог / задача" title={query.data?.fields.find(({ key }) => key === "title")?.value || "Задача"} actions={<Link className="market-text-link" to="/catalog">Все задачи ↗</Link>}><QueryState query={query}>{(task) => task.status !== "PUBLISHED" ? <p className="market-error">Эта задача ещё не опубликована.</p> : <><div className="market-detail-top"><span className="market-meta">{task.topic || "Без темы"} · {LEVEL[task.level]}</span><Link className="market-button market-button--accent" to={`/tasks/${task.id}/proposal`}>Подать предложение</Link></div><ScoreBreakdown task={task} /><TaskFields task={task} /></>}</QueryState></PageFrame>;
}

export function TeamPage() {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const [teamId, setTeamId] = useState(() => window.localStorage.getItem("baspaldaq:team-id"));
  const query = useQuery({ queryKey: ["team", teamId], queryFn: () => getTeam(teamId), enabled: Boolean(teamId), retry: false });
  const [form, setForm] = useState({ name: "", interests: "", skills: "", technologies: "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => { if (query.data) setForm({ name: query.data.name, interests: query.data.interests, skills: query.data.skills, technologies: query.data.technologies }); }, [query.data]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { const team = teamId ? await updateTeam(teamId, form) : await createTeam(form); window.localStorage.setItem("baspaldaq:team-id", team.id); setTeamId(team.id); setNotice("Профиль команды сохранён."); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <PageFrame eyebrow="Студенческая команда" title={teamId ? "Профиль команды" : "Создать команду"} actions={<Link className="market-text-link" to="/catalog">Каталог задач ↗</Link>}><div className="market-profile-layout"><form className="market-edit-form" onSubmit={save}>{Object.entries({ name: "Название команды", interests: "Интересы", skills: "Навыки", technologies: "Технологии" }).map(([key, label]) => <label className="market-field market-field--wide" key={key}><span>{label}</span><input value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} maxLength={key === "name" ? 120 : 500} required={key === "name"} disabled={busy} /></label>)}<button className="market-button market-button--accent" type="submit" disabled={busy}>{busy ? "Сохраняем…" : teamId ? "Сохранить профиль" : "Создать команду"}</button></form><aside className="market-profile-aside"><span>ПРОГРЕСС</span><strong>{query.data?.points || 0}</strong><p>Баллы начисляются только после подтверждения этапа бизнесом.</p>{next && teamId && <Link className="market-button" to={next}>Вернуться к предложению ↗</Link>}</aside></div>{error && <p className="market-error" role="alert">{error}</p>}{notice && <p className="market-success" role="status">{notice}</p>}</PageFrame>;
}

export function ProposalPage() {
  const { taskId } = useParams(); const query = useTask(taskId);
  const teamId = window.localStorage.getItem("baspaldaq:team-id");
  const [form, setForm] = useState({ solutionIdea: "", plan: "", timeline: "", prototypeUrl: "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [submitted, setSubmitted] = useState(null);
  async function send(event) { event.preventDefault(); setBusy(true); setError(""); try { setSubmitted(await submitProposal(taskId, { ...form, teamId })); } catch (failure) { setError(failure.message); } finally { setBusy(false); } }
  return <PageFrame eyebrow="Команда / предложение" title={query.data?.fields.find(({ key }) => key === "title")?.value || "Предложение"} actions={<Link className="market-text-link" to={`/tasks/${taskId}`}>К задаче ↗</Link>}><QueryState query={query}>{(task) => task.status !== "PUBLISHED" ? <p className="market-error">Задача ещё не опубликована.</p> : submitted ? <div className="market-success-block"><h2>Предложение отправлено</h2><p>Бизнес увидит вашу идею и вручную примет решение.</p><Link className="market-button" to="/catalog">К каталогу</Link></div> : !teamId ? <div className="market-state"><p>Сначала создайте профиль команды, чтобы предложение было привязано к ней.</p><Link className="market-button market-button--accent" to={`/team?next=${encodeURIComponent(`/tasks/${taskId}/proposal`)}`}>Создать команду</Link></div> : <form className="market-edit-form market-proposal-form" onSubmit={send}>{Object.entries({ solutionIdea: "Идея решения", plan: "План работы", timeline: "Сроки", prototypeUrl: "Ссылка на прототип" }).map(([key, label]) => <label className="market-field market-field--wide" key={key}><span>{label}</span>{key === "prototypeUrl" ? <input type="url" value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} maxLength={1000} required disabled={busy} placeholder="https://" /> : <textarea value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} rows={key === "timeline" ? 2 : 5} maxLength={key === "timeline" ? 500 : 3000} minLength={key === "timeline" ? 2 : 10} required disabled={busy} />}</label>)}<button className="market-button market-button--accent" type="submit" disabled={busy}>{busy ? "Отправляем…" : "Отправить предложение"}</button>{error && <p className="market-error" role="alert">{error}</p>}</form>}</QueryState></PageFrame>;
}

export function BusinessProposalsPage() {
  const { taskId } = useParams(); const task = useTask(taskId);
  const proposals = useQuery({ queryKey: ["proposals", taskId], queryFn: () => listProposals(taskId) });
  const milestones = useQuery({ queryKey: ["milestones", taskId], queryFn: () => listMilestones(taskId) });
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [title, setTitle] = useState(""); const [teamId, setTeamId] = useState("");
  async function run(key, action) { setBusy(key); setError(""); try { await action(); await Promise.all([queryClient.invalidateQueries({ queryKey: ["proposals", taskId] }), queryClient.invalidateQueries({ queryKey: ["milestones", taskId] })]); } catch (failure) { setError(failure.message); } finally { setBusy(""); } }
  return <PageFrame eyebrow="Бизнес / решение" title={task.data?.fields.find(({ key }) => key === "title")?.value || "Предложения команд"} actions={<Link className="market-text-link" to={`/business/tasks/${taskId}/review`}>Карточка задачи ↗</Link>}><QueryState query={proposals}>{(items) => items.length ? <div className="market-proposals">{items.map((proposal) => <article className="market-proposal" key={proposal.id}><div className="market-proposal-heading"><div><span className="market-meta">{proposal.team.name} · {proposal.status === "PENDING" ? "Ожидает решения" : proposal.status === "ACCEPTED" ? "Принято" : "Отклонено"}</span><h2>{proposal.solutionIdea}</h2></div></div><dl><dt>План</dt><dd>{proposal.plan}</dd><dt>Сроки</dt><dd>{proposal.timeline}</dd><dt>Прототип</dt><dd><a href={proposal.prototypeUrl} target="_blank" rel="noreferrer">Открыть ссылку ↗</a></dd></dl><div className="market-form-actions"><button className="market-button market-button--accent" type="button" disabled={Boolean(busy) || proposal.status === "ACCEPTED"} onClick={() => run(proposal.id, () => decideProposal(proposal.id, "ACCEPTED"))}>Принять</button><button className="market-button" type="button" disabled={Boolean(busy) || proposal.status === "REJECTED"} onClick={() => run(proposal.id, () => decideProposal(proposal.id, "REJECTED"))}>Отклонить</button></div></article>)}</div> : <p className="market-state">Предложений пока нет. Опубликованная задача уже доступна командам в каталоге.</p>}</QueryState>
    <section className="market-milestones"><h2>Подтверждённый прогресс</h2><QueryState query={milestones}>{(items) => items.length ? <div className="market-list">{items.map((item) => <div className="market-list-item" key={item.id}><div><strong>{item.title}</strong><p>{item.team.name} · {item.confirmedAt ? `Подтверждено, +${item.points} баллов` : "Ожидает подтверждения"}</p></div>{!item.confirmedAt && <button className="market-button" type="button" disabled={Boolean(busy)} onClick={() => run(item.id, () => confirmMilestone(item.id))}>Подтвердить этап</button>}</div>)}</div> : <p className="market-state">После принятия команды здесь можно отметить один реальный этап.</p>}</QueryState>{proposals.data?.some(({ status }) => status === "ACCEPTED") && <form className="market-milestone-form" onSubmit={(event) => { event.preventDefault(); run("milestone", () => createMilestone(taskId, teamId, title)).then(() => setTitle("")); }}><label>Команда<select value={teamId} onChange={(event) => setTeamId(event.target.value)} required><option value="">Выберите команду</option>{[...new Map(proposals.data.filter(({ status }) => status === "ACCEPTED").map(({ team }) => [team.id, team])).values()].map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label>Название этапа<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={160} required /></label><button className="market-button" type="submit" disabled={Boolean(busy)}>Добавить этап</button></form>}</section>{error && <p className="market-error" role="alert">{error}</p>}
  </PageFrame>;
}
