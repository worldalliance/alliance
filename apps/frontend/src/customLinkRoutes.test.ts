import { CUSTOM_LINK_RESERVED_SLUGS } from "@alliance/common/customLinks";
import type { RouteConfigEntry } from "@react-router/dev/routes";
import routes from "./routes";

function checkRoutes(entries: RouteConfigEntry[], parent = "") {
  for (const entry of entries) {
    const path = `${parent}/${entry.path ?? ""}`.replace(/\/+/g, "/");
    const firstSegment = path.split("/")[1].toLowerCase();
    if (firstSegment && !firstSegment.startsWith(":")) {
      expect(CUSTOM_LINK_RESERVED_SLUGS.has(firstSegment)).toBe(true);
    }
    if (entry.children) checkRoutes(entry.children, path);
  }
}

test("custom links reserve every existing app route prefix", () => {
  checkRoutes(routes);
});

test("custom paths resolve through the generic route", () => {
  expect(routes.some((route) => route.path === "/100k")).toBe(false);
  expect(routes.find((route) => route.path === "/:customLinkSlug")?.file).toBe(
    "pages/static/CustomLinkRedirect.tsx",
  );
});
