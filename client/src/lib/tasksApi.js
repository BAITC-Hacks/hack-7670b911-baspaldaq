const apiBaseUrl = import.meta.env.DEV ? "" : import.meta.env.VITE_API_URL;

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Не удалось подключиться к серверу. Проверьте, запущен ли API.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Не удалось обработать запрос. Попробуйте ещё раз.");
  }

  return payload;
}

export function analyzeTask(description) {
  return request("/tasks/analyze", {
    method: "POST",
    body: JSON.stringify({ description }),
  }).then(({ task }) => task);
}

export function answerTaskQuestion(taskId, questionId, message) {
  return request(`/tasks/${encodeURIComponent(taskId)}/answers`, {
    method: "POST",
    body: JSON.stringify({ questionId, message }),
  });
}

export function skipTaskQuestion(taskId, questionId) {
  return request(`/tasks/${encodeURIComponent(taskId)}/answers`, {
    method: "POST",
    body: JSON.stringify({ questionId, skip: true }),
  });
}

export function confirmTaskFields(taskId, fields) {
  return request(`/tasks/${encodeURIComponent(taskId)}/confirm`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
}
