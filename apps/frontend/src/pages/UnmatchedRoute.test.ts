import { expect, it } from "bun:test";
import { createStaticHandler } from "react-router";
import { action, loader } from "./UnmatchedRoute";

it.each(["GET", "POST"])(
  "answers a %s to a path no page claims with 404",
  async (method) => {
    const handler = createStaticHandler([
      {
        id: "root",
        path: "/",
        hasErrorBoundary: true,
        children: [{ id: "unmatched", path: "*", loader, action }],
      },
    ]);

    const context = await handler.query(
      new Request("http://localhost/a/b/c", { method }),
    );

    expect(
      context instanceof Response ? context.status : context.statusCode,
    ).toBe(404);
  },
);
