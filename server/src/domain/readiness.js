export const DIMENSIONS = Object.freeze([
  { key: "CONTEXT_AND_NEED", label: "Контекст и потребность", weight: 20 },
  { key: "DATA_AND_MATERIALS", label: "Данные и материалы", weight: 20 },
  { key: "EXPECTED_RESULT", label: "Ожидаемый результат", weight: 15 },
  { key: "SUCCESS_CRITERIA", label: "Критерии успеха", weight: 15 },
  { key: "CONSTRAINTS", label: "Ограничения", weight: 10 },
  { key: "USERS", label: "Пользователи", weight: 10 },
  { key: "BUSINESS_CONNECTION", label: "Связь с бизнесом", weight: 10 },
]);

const LEVELS = [
  { minimum: 90, level: "priority" },
  { minimum: 70, level: "ready" },
  { minimum: 40, level: "workable" },
  { minimum: 0, level: "draft" },
];

const IMPROVEMENTS = {
  CONTEXT_AND_NEED: "Опишите текущую ситуацию и что именно нужно изменить.",
  DATA_AND_MATERIALS: "Укажите доступные данные, материалы или примеры.",
  EXPECTED_RESULT: "Опишите конкретный результат, который должна подготовить команда.",
  SUCCESS_CRITERIA: "Укажите, по каким признакам вы примете решение.",
  CONSTRAINTS: "Добавьте сроки, ограничения доступа или другие важные условия.",
  USERS: "Уточните, кто будет пользоваться решением.",
  BUSINESS_CONNECTION: "Укажите контакт и удобный формат обратной связи с бизнесом.",
};

export function readinessLevel(score) {
  return LEVELS.find(({ minimum }) => score >= minimum).level;
}

export function calculateReadiness(dimensions) {
  const dimensionMap = new Map(dimensions.map((dimension) => [dimension.key, dimension]));
  const breakdown = DIMENSIONS.map(({ key, label, weight }) => {
    const dimension = dimensionMap.get(key);
    const status = dimension?.confirmed ? dimension.status : "missing";
    const earned = status === "complete" ? weight : status === "partial" ? weight / 2 : 0;

    return { dimension: key, label, earned, maximum: weight, status };
  });
  const score = Math.round(breakdown.reduce((total, item) => total + item.earned, 0));
  const level = readinessLevel(score);
  const missing = breakdown
    .filter(({ status }) => status !== "complete")
    .map(({ dimension, label, earned, maximum, status }) => ({
      dimension,
      label,
      status,
      current: earned,
      maximum,
      potentialGain: maximum - earned,
      message: IMPROVEMENTS[dimension],
    }));

  return { score: Math.min(100, score), level, breakdown, missing };
}
