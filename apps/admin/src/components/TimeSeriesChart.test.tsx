import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TimeSeriesChart, type DataPoint } from "./TimeSeriesChart";

afterEach(cleanup);

beforeEach(() => {
  jest
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(0, 0, 500, 175));
});

const at = (chartX: number, chartY: number) => ({
  clientX: chartX / 2,
  clientY: chartY / 2,
});

const datePoints: DataPoint[] = [
  { date: new Date(2026, 0, 1), count: 1, goal: 5 },
  { date: new Date(2026, 0, 2), count: 3, goal: 4 },
];

const dedupedPercentProps = {
  yTickLabelDedup: true,
  yDomain: [0, 0.02] satisfies [number, number],
  yAxisFormat: (value: number) => `${Math.round(value * 100)}%`,
};

const renderDateChart = (
  data: DataPoint[],
  options: {
    yTickLabelDedup?: boolean;
    showHoverOnlyOnHover?: boolean;
    showArea?: boolean;
    areaSeriesKey?: string;
  } = {},
) =>
  render(
    <TimeSeriesChart
      title="Signups"
      data={data}
      showHoverOnlyOnHover={options.showHoverOnlyOnHover}
      showArea={options.showArea}
      areaSeriesKey={options.areaSeriesKey}
      series={[
        {
          key: "count",
          label: "Count",
          color: "#000",
          getValue: (d) => Number(d.count),
        },
        {
          key: "goal",
          label: "Goal",
          color: "#222",
          getValue: (d) => Number(d.goal),
        },
      ]}
      getHoverContent={(point) => ({
        title: `Count ${String(point.count)}`,
        items: [
          {
            label: "Joined",
            value: `${String(point.count)} signups`,
            color: "#123456",
          },
        ],
      })}
      {...(options.yTickLabelDedup && dedupedPercentProps)}
    />,
  );

const renderNumericChart = (
  options: {
    showDataPoints?: boolean;
    yTickLabelDedup?: boolean;
    getHoverXLabel?: (point: DataPoint) => string;
    xAxisFormat?: (value: number) => string;
    xRange?: { min: number; max: number };
  } = {},
) =>
  render(
    <TimeSeriesChart
      title="Curves"
      xType="number"
      showDataPoints={options.showDataPoints}
      getHoverXLabel={options.getHoverXLabel}
      xAxisFormat={options.xAxisFormat}
      xRange={options.xRange}
      getXValue={(d) => Number(d.x)}
      getYValue={(d) => Number(d.y)}
      multiLineData={[
        {
          key: "a",
          label: "A",
          color: "#000",
          data: [
            { x: 0, y: 1 },
            { x: 1, y: 2 },
          ],
        },
        {
          key: "b",
          label: "B",
          color: "#111",
          data: [
            { x: 0, y: 2 },
            { x: 1, y: 1 },
          ],
        },
      ]}
      getHoverContent={(point, series) => ({
        title: `${series.label} at ${String(point.x)}`,
        items: [
          {
            label: "Share",
            value: `${String(point.y)} done`,
            color: "#654321",
          },
        ],
      })}
      {...(options.yTickLabelDedup && dedupedPercentProps)}
    />,
  );

const expectDedupedPercentGrid = (container: HTMLElement) => {
  for (const label of ["0%", "1%", "2%"]) {
    expect(screen.getAllByText(label)).toHaveLength(1);
  }
  const gridLine = container.querySelector('line[stroke-dasharray="4 6"]');
  expect(gridLine?.getAttribute("x1")).toBe("72");
  expect(gridLine?.getAttribute("x2")).toBe("968");
};

describe("TimeSeriesChart", () => {
  it("shows the empty message without data", () => {
    renderDateChart([]);
    expect(screen.getByText("No data available.")).toBeTruthy();
  });

  it("hovers the date nearest the pointer, and the latest date otherwise", () => {
    const { container } = renderDateChart(datePoints);
    expect(screen.getByText("Count 3")).toBeTruthy();
    expect(screen.getByText("Joined")).toBeTruthy();
    expect(screen.getByText("3 signups")).toBeTruthy();
    expect(container.querySelector('rect[fill="#123456"]')).not.toBeNull();
    const svg = container.querySelector("svg")!;
    fireEvent.mouseMove(svg, at(72, 174));
    expect(screen.getByText("Count 1")).toBeTruthy();
    fireEvent.mouseMove(svg, at(968, 174));
    expect(screen.getByText("Count 3")).toBeTruthy();
    fireEvent.mouseMove(svg, at(430, 174));
    expect(screen.getByText("Count 1")).toBeTruthy();
    fireEvent.mouseMove(svg, at(72, 174));
    fireEvent.mouseLeave(svg);
    expect(screen.getByText("Count 3")).toBeTruthy();
  });

  it("hovers nothing on a hover-only date chart until the pointer moves", () => {
    const { container } = renderDateChart(datePoints, {
      showHoverOnlyOnHover: true,
    });
    expect(screen.queryByText(/^Count/)).toBeNull();
    fireEvent.mouseMove(container.querySelector("svg")!, at(968, 174));
    expect(screen.getByText("Count 3")).toBeTruthy();
  });

  it("fills the area under a date chart's line only with showArea", () => {
    const filled = 'path[fill="rgba(8,145,178,0.12)"]';
    const { container, unmount } = renderDateChart(datePoints);
    expect(container.querySelector(filled)).toBeNull();
    unmount();
    expect(
      renderDateChart(datePoints, { showArea: true }).container.querySelector(
        filled,
      ),
    ).not.toBeNull();
  });

  it("fills the area under the series areaSeriesKey names", () => {
    const areaPath = (areaSeriesKey?: string) => {
      const { container, unmount } = renderDateChart(datePoints, {
        showArea: true,
        areaSeriesKey,
      });
      const d = container
        .querySelector('path[fill="rgba(8,145,178,0.12)"]')
        ?.getAttribute("d");
      unmount();
      return d;
    };
    expect(areaPath("goal")).not.toBe(areaPath());
    expect(areaPath("count")).toBe(areaPath());
  });

  const xTickLabels = (container: HTMLElement) =>
    [...container.querySelectorAll('text[text-anchor="middle"]')].map(
      (text) => text.textContent,
    );

  it("labels x ticks with dates or the numeric x format", () => {
    expect(xTickLabels(renderDateChart(datePoints).container)).toEqual([
      "Jan 1",
      "Jan 1",
      "Jan 2",
    ]);
    cleanup();
    expect(
      xTickLabels(
        renderNumericChart({ xAxisFormat: (value) => `x=${value}` }).container,
      ),
    ).toEqual(["x=0", "x=0.5", "x=1"]);
  });

  it("spans a numeric chart's x axis over xRange", () => {
    const { container } = renderNumericChart({ xRange: { min: 0, max: 4 } });
    expect(container.querySelectorAll("circle")[1].getAttribute("cx")).toBe(
      "296",
    );
  });

  it("labels the hovered x value above a numeric chart", () => {
    const { container } = renderNumericChart({
      showDataPoints: false,
      getHoverXLabel: (point) => `Day ${String(point.x)}`,
    });
    expect(screen.queryByText("Day 1")).toBeNull();
    fireEvent.mouseMove(container.querySelector("svg")!, at(968, 52));
    expect(screen.getByText("Day 1")).toBeTruthy();
  });

  it("hovers the numeric point nearest the pointer until it leaves", () => {
    const { container } = renderNumericChart({ showDataPoints: false });
    const svg = container.querySelector("svg")!;
    fireEvent.mouseMove(svg, at(72, 174));
    expect(screen.getByText("A at 0")).toBeTruthy();
    fireEvent.mouseMove(svg, at(968, 52));
    expect(screen.getByText("A at 1")).toBeTruthy();
    fireEvent.mouseMove(svg, at(72, 52));
    expect(screen.getByText("B at 0")).toBeTruthy();
    fireEvent.mouseLeave(svg);
    expect(screen.queryByText(/ at /)).toBeNull();
  });

  it("shows a numeric data point's hover content while hovered", () => {
    const { container } = renderNumericChart();
    expect(screen.queryByText("A at 1")).toBeNull();
    const circle = container.querySelectorAll("circle")[1];
    fireEvent.mouseEnter(circle);
    expect(screen.getByText("A at 1")).toBeTruthy();
    expect(screen.getByText("Share:")).toBeTruthy();
    expect(screen.getByText("2 done").getAttribute("style")).toContain(
      "color: #654321",
    );
    fireEvent.mouseOut(circle, {
      relatedTarget: container.querySelector("svg"),
    });
    expect(screen.queryByText("A at 1")).toBeNull();
  });

  it("draws one y grid label per formatted value on a date chart", () => {
    const { container } = renderDateChart(datePoints, {
      yTickLabelDedup: true,
    });
    expectDedupedPercentGrid(container);
  });

  it("draws one y grid label per formatted value on a numeric chart", () => {
    const { container } = renderNumericChart({ yTickLabelDedup: true });
    expectDedupedPercentGrid(container);
  });
});
