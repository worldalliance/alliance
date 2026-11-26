import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { formatDate } from "../../lib/formatDate";
import ResponsesViewBar, { ResponsesTab } from "./ResponsesViewBar";

const renderBar = (
  overrides: Partial<React.ComponentProps<typeof ResponsesViewBar>> = {},
) => {
  const onTabChange = jest.fn();
  render(
    <ResponsesViewBar
      responses={[
        makeFormResponse({ createdAt: "2026-03-05T10:00:00.000Z" }),
        makeFormResponse({ createdAt: "2026-02-01T10:00:00.000Z" }),
      ]}
      total={0}
      loading={false}
      error={null}
      tab={ResponsesTab.Replays}
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

it("dates the first response from the earliest of every response", () => {
  renderBar();

  const first = formatDate("2026-02-01T10:00:00.000Z");
  expect(screen.getByText(`0 responses · first ${first}`)).toBeTruthy();
});

it("reports the tab picked", () => {
  const onTabChange = renderBar();
  fireEvent.click(screen.getByText("Questions"));

  expect(onTabChange).toHaveBeenCalledWith("questions");
});

it("offers snapshot reassignment only with a handler for it", () => {
  renderBar();
  expect(screen.queryByText("Reassign snapshots")).toBeNull();
  cleanup();

  const onReassign = jest.fn();
  renderBar({ onReassignSnapshots: onReassign });
  fireEvent.click(screen.getByText("Reassign snapshots"));
  expect(onReassign).toHaveBeenCalled();
});

it("disables the CSV export when the selected variant has no responses, but not the HTML one", async () => {
  renderBar();
  fireEvent.click(screen.getByRole("button", { name: "Export" }));

  const csv = await screen.findByRole("menuitem", { name: /^Export CSV/ });
  const html = screen.getByRole("menuitem", { name: /^Export HTML/ });
  expect(csv.getAttribute("aria-disabled")).toBe("true");
  expect(html.getAttribute("aria-disabled")).not.toBe("true");
});

it("reports the variant picked, and no variant for all of them", () => {
  const onVariantChange = jest.fn();
  renderBar({
    variantOptions: [
      { key: "short", variantId: 2, formId: 5, name: "Short" },
      { key: "long", variantId: 3, formId: 6, name: "Long" },
    ],
    selectedVariantKey: "short",
    onVariantChange,
  });
  const select = screen.getByLabelText("Variant");
  fireEvent.change(select, { target: { value: "long" } });
  fireEvent.change(select, { target: { value: "all" } });

  expect(onVariantChange.mock.calls).toEqual([["long"], [null]]);
});

it("shows no response count while the responses load", () => {
  renderBar({ loading: true });
  expect(screen.queryByText(/\d+ responses?/)).toBeNull();
  expect(screen.getByText("—")).toBeTruthy();
});
