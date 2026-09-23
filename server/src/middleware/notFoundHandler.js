export function notFoundHandler(request, response) {
  response.status(404).json({
    error: "Not Found",
    path: request.originalUrl,
  });
}
