import { fireEvent, screen, within } from "@testing-library/react";

/** Opens the `ChartData` table captioned `name` and returns its body rows' cell text. */
export const openChartData = async (name: string) => {
  const summary = (await screen.findAllByText("Show data")).find(
    (element) => element.textContent === `Show data for ${name}`,
  );
  if (!summary) throw new Error(`no data for ${name}`);
  fireEvent.click(summary);
  const table = await screen.findByRole("table", { name });
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => [...row.children].map((cell) => cell.textContent));
};
