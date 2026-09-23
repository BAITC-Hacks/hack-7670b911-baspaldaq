export function errorHandler(error, _request, response, next) {
  console.error(error);

  if (response.headersSent) {
    return next(error);
  }

  response.status(500).json({ error: "Internal Server Error" });
}
