import { prisma } from "../src/db/prisma.js";
import { calculateReadiness, DIMENSIONS } from "../src/domain/readiness.js";
import { DIMENSION_FIELDS } from "../src/domain/taskAnalysis.js";
import { env } from "../src/config/env.js";

if (env.nodeEnv === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
  throw new Error("Synthetic demo seed is disabled in production unless ALLOW_DEMO_SEED=true");
}

const cards = [
  {
    topic: "Розница",
    title: "Прогноз остатков для сети магазинов",
    context: "Менеджеры сети вручную сверяют остатки в нескольких таблицах.",
    need: "Снизить число отсутствующих на полке товаров и лишних закупок.",
    users: "Менеджеры магазинов и закупщики.",
    dataMaterials: "История продаж и выгрузки остатков за прошлые месяцы.",
    expectedResult: "Прототип прогноза спроса и наглядная панель остатков.",
    successCriteria: "На тестовой выборке прогноз точнее текущего ручного плана.",
    constraints: "Доступ к данным только после удаления персональных сведений.",
    contact: "Руководитель отдела закупок.",
    interactionFormat: "Еженедельная встреча и обратная связь по прототипу.",
  },
  {
    topic: "Производство",
    title: "Цифровой журнал простоев оборудования",
    context: "Смены фиксируют причины остановок на бумаге.",
    need: "Понять, какие простои повторяются чаще всего.",
    users: "Мастера смен и инженер по обслуживанию.",
    dataMaterials: "Фотографии существующих журналов и обезличенные записи.",
    expectedResult: "Рабочий прототип журнала с отчётом по причинам простоя.",
    constraints: "Прототип должен работать без доступа к закрытой заводской сети.",
    interactionFormat: "Одна демонстрация в неделю с инженером.",
  },
  {
    topic: "Образование",
    title: "Сбор обратной связи после занятий",
    context: "Учебный центр получает отзывы в мессенджерах и теряет часть ответов.",
    need: "Собирать обратную связь в одном месте и видеть повторяющиеся проблемы.",
    users: "Методисты и преподаватели.",
    expectedResult: "Простая форма и экран сводки по отзывам.",
    successCriteria: "Методист видит частые темы без ручного просмотра сообщений.",
  },
  {
    topic: "Сервис",
    title: "Очередь заявок в сервисный центр",
    context: "Администратор вручную распределяет заявки между мастерами.",
    need: "Сделать статус каждой заявки понятным сотрудникам и клиентам.",
    expectedResult: "Прототип панели статусов заявок.",
  },
  {
    topic: "Сельское хозяйство",
    title: "Учёт полива участка",
    need: "Упростить фиксацию времени и объёма полива на нескольких участках.",
    expectedResult: "Небольшой прототип журнала полива.",
  },
];

const teams = [
  { name: "Demo: Data Lab", interests: "Аналитика розницы", skills: "Анализ данных, UX", technologies: "Python, React" },
  { name: "Demo: Shift Flow", interests: "Промышленные процессы", skills: "Интерфейсы, базы данных", technologies: "React, SQLite" },
  { name: "Demo: Learning Loop", interests: "Образование", skills: "Исследование, прототипирование", technologies: "Figma, TypeScript" },
  { name: "Demo: Service Desk", interests: "Сервисные операции", skills: "Frontend, API", technologies: "React, Node.js" },
  { name: "Demo: Field Notes", interests: "Агротехнологии", skills: "Мобильные интерфейсы", technologies: "React, CSS" },
];

const proposalIdeas = [
  "Соберём прогноз по истории продаж и покажем отклонения от фактических остатков.",
  "Сделаем электронную запись остановок и сгруппируем причины по оборудованию.",
  "Создадим короткую форму оценки занятия и сводку повторяющихся тем.",
  "Разработаем единый список заявок со статусами для администратора и мастеров.",
  "Соберём журнал полива по участкам с удобным вводом с телефона.",
];

function dimensionState(card, key) {
  const keys = DIMENSION_FIELDS[key];
  const values = keys.filter((field) => card[field]);
  const evidence = values.map((field) => ({ sourceId: `seed:${field}`, quote: card[field] }));
  return { key, status: values.length === 0 ? "missing" : values.length === keys.length ? "complete" : "partial", evidence };
}

try {
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const draftId = `demo-draft-${index + 1}`;
    if (!await prisma.task.findUnique({ where: { id: draftId } })) {
      await prisma.task.create({ data: {
        id: draftId,
        description: `Демо-черновик: ${card.need}`,
        status: "DRAFT",
        topic: card.topic,
      } });
    }

    const taskId = `demo-card-${index + 1}`;
    if (!await prisma.task.findUnique({ where: { id: taskId } })) {
      const dimensions = DIMENSIONS.map(({ key }) => dimensionState(card, key));
      const readiness = calculateReadiness(dimensions.map(({ key, status, evidence }) => ({ key, status, evidence, confirmed: evidence.length > 0 })));
      const now = new Date();
      await prisma.task.create({ data: {
        id: taskId,
        description: [card.context, card.need].filter(Boolean).join(" "),
        topic: card.topic,
        score: readiness.score,
        level: readiness.level,
        status: "PUBLISHED",
        confirmedAt: now,
        publishedAt: now,
        fields: { create: Object.entries(card).filter(([key]) => key !== "topic").map(([key, value]) => ({
          key, value, status: "confirmed", provenance: "manual_edit", sourceId: `seed:${key}`,
          evidence: JSON.stringify([{ sourceId: `seed:${key}`, quote: value }]),
        })) },
        dimensions: { create: dimensions.map(({ key, status, evidence }) => ({ key, aiStatus: status, evidence: JSON.stringify(evidence) })) },
      } });
    }

    const teamId = `demo-team-${index + 1}`;
    if (!await prisma.team.findUnique({ where: { id: teamId } })) {
      await prisma.team.create({ data: { id: teamId, ...teams[index] } });
    }

    const proposalId = `demo-proposal-${index + 1}`;
    if (!await prisma.proposal.findUnique({ where: { id: proposalId } })) {
      await prisma.proposal.create({ data: {
        id: proposalId,
        taskId,
        teamId,
        solutionIdea: proposalIdeas[index],
        plan: "Изучим процесс с представителем бизнеса, соберём прототип и проверим его на примерах.",
        timeline: "Четыре недели после согласования задачи.",
        prototypeUrl: `https://example.org/demo-prototype-${index + 1}`,
      } });
    }
  }

  console.log("Demo seed ready: 5 drafts, 5 published cards, 5 teams, 5 proposals.");
} finally {
  await prisma.$disconnect();
}
