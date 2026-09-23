import { AppError } from "../errors/AppError.js";

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
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: error instanceof AppError ? error.message : "Не удалось обработать запрос. Попробуйте ещё раз.",
    },
  });
}
