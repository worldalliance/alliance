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
      updating={false}
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
      "var(--color-chart-2)",
      "var(--color-chart-1)",
    ]);
    expect(paths.every((path) => path.getAttribute("d"))).toBe(true);
  });

  it("describes the point nearest the pointer while hovering", () => {
    const { container } = renderChart();
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("no chart");
    svg.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 350);

    const valueOf = (label: string) =>
      screen.getByText(label, { selector: "dt span" }).closest("div")?.querySelector("dd")?.textContent;
    fireEvent.mouseMove(svg, { clientX: 900 });
    expect(valueOf("Churn")).toBe("20%");
    expect(valueOf("Active members")).toBe("12");

    fireEvent.mouseMove(svg, { clientX: 100 });
    expect(valueOf("Churn")).toBe("0%");
    expect(valueOf("Active members")).toBe("10");

    fireEvent.mouseLeave(svg);
    expect(screen.queryByText("Churn")).toBeNull();
  });

  it("reads each date from the keyboard", () => {
    const { container } = renderChart();
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("no chart");

    fireEvent.keyDown(svg, { key: "End" });
    expect(screen.getByText("Churned members", { selector: "dt span" })).toBeTruthy();
    fireEvent.keyDown(svg, { key: "Escape" });
    expect(screen.queryByText("Churn")).toBeNull();
  });
});
