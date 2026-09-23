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
    throw new Error(payload.error?.message || "Не удалось обработать запрос. Попробуйте ещё раз.");
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
  return request(`/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });
}

export function getTask(taskId) {
  return request(`/tasks/${encodeURIComponent(taskId)}`).then(({ task }) => task);
}

export function listTasks(filters = {}) {
  const search = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
  return request(`/tasks?${search}`).then(({ tasks }) => tasks);
}

export function saveTaskCard(taskId, fields, topic) {
  return request(`/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", body: JSON.stringify({ fields, topic }) }).then(({ task }) => task);
}

export function confirmTask(taskId) {
  return request(`/tasks/${encodeURIComponent(taskId)}/confirm`, { method: "POST" }).then(({ task }) => task);
}

export function publishTask(taskId) {
  return request(`/tasks/${encodeURIComponent(taskId)}/publish`, { method: "POST" }).then(({ task }) => task);
}

export function listTeams() { return request("/teams").then(({ teams }) => teams); }
export function getTeam(teamId) { return request(`/teams/${encodeURIComponent(teamId)}`).then(({ team }) => team); }
export function createTeam(data) { return request("/teams", { method: "POST", body: JSON.stringify(data) }).then(({ team }) => team); }
export function updateTeam(teamId, data) { return request(`/teams/${encodeURIComponent(teamId)}`, { method: "PATCH", body: JSON.stringify(data) }).then(({ team }) => team); }
export function listProposals(taskId) { return request(`/tasks/${encodeURIComponent(taskId)}/proposals`).then(({ proposals }) => proposals); }
export function submitProposal(taskId, data) { return request(`/tasks/${encodeURIComponent(taskId)}/proposals`, { method: "POST", body: JSON.stringify(data) }).then(({ proposal }) => proposal); }
export function decideProposal(proposalId, status) { return request(`/proposals/${encodeURIComponent(proposalId)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }).then(({ proposal }) => proposal); }
export function listMilestones(taskId) { return request(`/tasks/${encodeURIComponent(taskId)}/milestones`).then(({ milestones }) => milestones); }
export function createMilestone(taskId, teamId, title) { return request(`/tasks/${encodeURIComponent(taskId)}/milestones`, { method: "POST", body: JSON.stringify({ teamId, title }) }).then(({ milestone }) => milestone); }
export function confirmMilestone(milestoneId) { return request(`/milestones/${encodeURIComponent(milestoneId)}/confirm`, { method: "PATCH" }).then(({ milestone }) => milestone); }
