/** The builder's read of a form's response count: a POST that writes nothing. */
export const isResponseCountsRead = (request: Request) =>
  new URL(request.url).pathname === "/tasks/responses/counts";
