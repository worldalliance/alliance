import type { ActionFormVariantStatsDto } from "@alliance/shared/client/types.gen";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ActionFormVariantCoverage from "./ActionFormVariantCoverage";

afterEach(cleanup);

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

const renderCoverage = (params: {
  percentageSum: number;
  hasVariants: boolean;
}) =>
  render(
    <MemoryRouter>
      <ActionFormVariantCoverage stats={stats} {...params} />
    </MemoryRouter>,
  );

describe("ActionFormVariantCoverage", () => {
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
