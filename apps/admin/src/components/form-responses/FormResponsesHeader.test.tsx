import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import FormResponsesHeader from "./FormResponsesHeader";

const renderHeader = (
  overrides: Partial<React.ComponentProps<typeof FormResponsesHeader>> = {},
) => {
  const onTabChange = jest.fn();
  render(
    <FormResponsesHeader
      title="Form"
      responses={[
        makeFormResponse({ createdAt: "2026-03-05T10:00:00.000Z" }),
        makeFormResponse({ createdAt: "2026-02-01T10:00:00.000Z" }),
      ]}
      total={0}
      tab="replays"
      onTabChange={onTabChange}
      selectedVariantKey=""
      onVariantChange={() => {}}
      onRefresh={() => {}}
      onExportCsv={() => {}}
      onExportHtml={() => {}}
      {...overrides}
    />,
  );
  return onTabChange;
};

it("dates the release from the earliest of every response", () => {
  renderHeader();

  const released = new Date("2026-02-01T10:00:00.000Z").toLocaleDateString(
    undefined,
    { day: "numeric", month: "short", year: "numeric" },
  );
  expect(screen.getByText(`Released ${released}`)).toBeTruthy();
});

it("reports the tab picked", () => {
  const onTabChange = renderHeader();
  fireEvent.click(screen.getByText("Questions"));

  expect(onTabChange).toHaveBeenCalledWith("questions");
});

it("offers snapshot reassignment only with a handler for it", () => {
  renderHeader();
  expect(screen.queryByText("Reassign snapshots")).toBeNull();
  cleanup();

  const onReassign = jest.fn();
  renderHeader({ onReassignSnapshots: onReassign });
  fireEvent.click(screen.getByText("Reassign snapshots"));
  expect(onReassign).toHaveBeenCalled();
});

it("disables the CSV export when the selected variant has no responses, but not the HTML one", () => {
  renderHeader();

  expect(screen.getByText("Export CSV").closest("button")?.disabled).toBe(true);
  expect(screen.getByText("Export HTML").closest("button")?.disabled).toBe(
    false,
  );
});

it("reports the variant picked, and no variant for all of them", () => {
  const onVariantChange = jest.fn();
  renderHeader({
    variantOptions: [
      { key: "short", variantId: 2, formId: 5, name: "Short" },
      { key: "long", variantId: 3, formId: 6, name: "Long" },
    ],
    selectedVariantKey: "short",
    onVariantChange,
  });
  const select = screen.getByTitle("Filter by variant");
  fireEvent.change(select, { target: { value: "long" } });
  fireEvent.change(select, { target: { value: "all" } });

  expect(onVariantChange.mock.calls).toEqual([["long"], [null]]);
});
