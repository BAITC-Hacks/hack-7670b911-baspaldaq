export function errorHandler(error, _request, response, next) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  console.error("Baspaldaq API request failed", {
    name: error.name || "Error",
    code: error.code || "INTERNAL_ERROR",
    status,
  });

  if (response.headersSent) {
    return next(error);
  }

  response.status(status).json({
    error: error.message && status < 500 ? error.message : "Не удалось обработать запрос. Попробуйте ещё раз.",
    code: error.code || "INTERNAL_ERROR",
  });
}
