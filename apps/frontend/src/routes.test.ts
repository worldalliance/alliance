import type { RouteConfigEntry } from "@react-router/dev/routes";
import { describe, expect, it } from "bun:test";
import { matchRoutes, type RouteObject } from "react-router";
import routes from "./routes";

const toRouteObject = ({
  file,
  path,
  index,
  children,
}: RouteConfigEntry): RouteObject =>
  index
    ? { id: file, path, index }
    : { id: file, path, children: children?.map(toRouteObject) };

describe("routes", () => {
  it("sends a path no page claims to the unmatched route", () => {
    expect(
      matchRoutes(routes.map(toRouteObject), "/a/b/c")?.at(-1)?.route.id,
    ).toBe("pages/UnmatchedRoute.tsx");
  });
});
