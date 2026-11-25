import { fireEvent, render, screen } from "@testing-library/react";
import { MembersOverTimePanel } from "./MembersOverTimePanel";

const point = (date: string, activeCount: number, churnedCount: number) => ({
  date,
  activeCount,
  churnedCount,
  totalEverSigned: activeCount + churnedCount,
  parsedDate: new Date(`${date}T12:00:00`),
});

const renderChart = () =>
  render(
    <MembersOverTimePanel
      history={[point("2026-01-01", 10, 0), point("2026-02-01", 12, 3)]}
      loading={false}
      error={null}
      onRetry={() => {}}
      range={{ start: "2026-01-01", end: "2026-02-01" }}
      onRangeChange={() => {}}
    />,
  );

describe("MembersOverTimePanel", () => {
  it("draws the churned area, then the active one", () => {
    const { container } = renderChart();

    const paths = Array.from(container.querySelectorAll("path"));
    expect(paths.map((path) => path.getAttribute("fill"))).toEqual([
      "var(--color-danger)",
      "var(--color-success)",
    ]);
    expect(paths.every((path) => path.getAttribute("d"))).toBe(true);
  });

  it("describes the point nearest the pointer while hovering", () => {
    const { container } = renderChart();
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("no chart");
    svg.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 350);

    fireEvent.mouseMove(svg, { clientX: 900 });
    expect(screen.getByText("20% churn")).toBeTruthy();
    expect(screen.getByText("12 members")).toBeTruthy();

    fireEvent.mouseMove(svg, { clientX: 100 });
    expect(screen.getByText("0% churn")).toBeTruthy();
    expect(screen.getByText("10 members")).toBeTruthy();

    fireEvent.mouseLeave(svg);
    expect(screen.queryByText(/% churn$/)).toBeNull();
  });
});
