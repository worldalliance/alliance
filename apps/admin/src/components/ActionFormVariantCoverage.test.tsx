import type { ActionFormVariantStatsDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ActionFormVariantCoverage from "./ActionFormVariantCoverage";

const stats: ActionFormVariantStatsDto[] = [
  {
    variantId: null,
    name: "Original",
    formId: 1,
    splitValue: null,
    assigned: 7,
    submitted: 3,
  },
  {
    variantId: 2,
    name: "Variant A",
    formId: 2,
    splitValue: 40,
    assigned: 5,
    submitted: 5,
  },
];

serveApi(
  routes({
    "GET /tasks/listForms": () =>
      Response.json([
        { id: 1, title: "Original", slug: "v1", displaySlug: "food-drive::v1" },
        {
          id: 2,
          title: "Variant A",
          slug: "v2",
          displaySlug: "food-drive::v2",
        },
      ]),
  }),
);

const renderCoverage = (params: {
  percentageSum: number;
  hasVariants: boolean;
}) =>
  render(
    <MemoryRouter>
      <ActionFormVariantCoverage stats={stats} {...params} />
    </MemoryRouter>,
    queryWrapper(),
  );

describe("ActionFormVariantCoverage", () => {
  it("names each group's form by its display slug", async () => {
    renderCoverage({ percentageSum: 40, hasVariants: true });
    expect(await screen.findByText("food-drive::v1")).toBeTruthy();
    expect(screen.getByText("food-drive::v2")).toBeTruthy();
  });

  it("totals assignments and submissions across groups", () => {
    renderCoverage({ percentageSum: 40, hasVariants: true });
    expect(screen.getByText("12 users assigned")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("remainder")).toBeTruthy();
    expect(
      screen.getByText(/Default form covers the remaining 60%/),
    ).toBeTruthy();
  });

  it("flags splits over 100%", () => {
    renderCoverage({ percentageSum: 120, hasVariants: true });
    expect(screen.getByText(/Percentage total 120% exceeds 100%/)).toBeTruthy();
  });

  it("says everyone sees the default form when there are no variants", () => {
    renderCoverage({ percentageSum: 0, hasVariants: false });
    expect(
      screen.getByText("No variants — all users see the default form."),
    ).toBeTruthy();
  });
});
