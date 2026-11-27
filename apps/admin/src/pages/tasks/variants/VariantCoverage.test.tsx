import type { ActionFormVariantStatsDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { VariantCoverage } from "./VariantCoverage";

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

const renderCoverage = (params: { splitTotal: number; hasVariants: boolean }) =>
  render(
    <MemoryRouter>
      <VariantCoverage stats={stats} {...params} />
    </MemoryRouter>,
    queryWrapper(),
  );

describe("VariantCoverage", () => {
  it("names each variant's form by its display slug", async () => {
    renderCoverage({ splitTotal: 40, hasVariants: true });
    expect(await screen.findByText("food-drive::v1")).toBeTruthy();
    expect(screen.getByText("food-drive::v2")).toBeTruthy();
  });

  it("totals assignments and submissions across variants", () => {
    renderCoverage({ splitTotal: 40, hasVariants: true });
    expect(screen.getByText("12 members assigned")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("Remainder")).toBeTruthy();
    expect(
      screen.getByText(/The default form covers the remaining 60%/),
    ).toBeTruthy();
  });

  it("says everyone sees the default form when there are no variants", () => {
    renderCoverage({ splitTotal: 0, hasVariants: false });
    expect(
      screen.getByText("No variants: every member sees the default form."),
    ).toBeTruthy();
  });
});
