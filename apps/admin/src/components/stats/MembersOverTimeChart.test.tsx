import { fireEvent, render, screen } from "@testing-library/react";
import MembersOverTimeChart from "./MembersOverTimeChart";

const point = (date: string, activeCount: number, churnedCount: number) => ({
  date,
  activeCount,
  churnedCount,
  totalEverSigned: activeCount + churnedCount,
  parsedDate: new Date(`${date}T12:00:00`),
});

const renderChart = () =>
  render(
    <MembersOverTimeChart
      parsedContractStatusHistory={[
        point("2026-01-01", 10, 0),
        point("2026-02-01", 12, 3),
      ]}
      contractStatusLoading={false}
      contractStatusError={null}
      contractStatusRange={{ start: "2026-01-01", end: "2026-02-01" }}
      setContractStatusRange={() => {}}
    />,
  );

describe("MembersOverTimeChart", () => {
  it("draws the churned area, then the active one", () => {
    const { container } = renderChart();

    const paths = Array.from(container.querySelectorAll("path"));
    expect(paths.map((path) => path.getAttribute("fill"))).toEqual([
      "rgba(239, 68, 68, 0.9)",
      "rgba(22, 163, 74, 0.8)",
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
