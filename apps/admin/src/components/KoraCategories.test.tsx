import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen, within } from "@testing-library/react";
import { KoraCategories } from "./KoraCategories";

serveApi(
  routes({
    "GET /kora/admin/categories": () =>
      Response.json({
        categories: [
          {
            category: "fear_trauma_and_distress",
            pairs: 4,
            reviewsNeeded: 7,
            optedOut: 2,
          },
          {
            category: "cybersecurity",
            pairs: 2,
            reviewsNeeded: 0,
            optedOut: 0,
          },
        ],
      }),
  }),
);

it("lists each category's pairs, reviews needed and opt-outs by its reviewer-facing name", async () => {
  render(<KoraCategories />, queryWrapper());
  const table = await screen.findByRole("table");
  const rows = within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );
  expect(rows.map((r) => r.slice(1))).toEqual([
    ["4", "7", "2"],
    ["2", "0", "0"],
  ]);
  expect(rows[0][0]).toBe("Fear and distress");
});
