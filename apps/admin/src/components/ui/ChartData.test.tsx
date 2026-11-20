import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "bun:test";
import ChartData from "./ChartData";

it("starts collapsed, then shows a table of the values with headed rows", async () => {
  render(
    <ChartData
      caption="Signups"
      columns={["Date", "Count"]}
      rows={[
        ["January 1, 2026", "1"],
        ["January 2, 2026", "3"],
      ]}
    />,
  );
  const summary = screen.getByText("Show data");
  expect(summary.tagName).toBe("SUMMARY");
  expect(summary.textContent).toBe("Show data for Signups");
  expect(screen.queryByRole("table")).toBeNull();

  fireEvent.click(screen.getByText("Show data"));
  const table = await screen.findByRole("table", { name: "Signups" });
  expect(
    screen.getByRole("region", { name: "Signups" }).getAttribute("tabindex"),
  ).toBe("0");
  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent),
  ).toEqual(["Date", "Count"]);
  expect(
    within(table)
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent),
  ).toEqual(["January 1, 2026", "January 2, 2026"]);
  expect(
    within(table)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["1", "3"]);
});
