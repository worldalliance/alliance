import type { ActionCompletionCurveDto } from "@alliance/shared/client/types.gen";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ActionCompletionCurveChart from "./ActionCompletionCurveChart";

afterEach(cleanup);

const curve = (actionId: number, actionName: string) =>
  ({
    actionId,
    actionName,
    usersJoined: 10,
    memberActionStartDate: "2026-01-01T00:00:00.000Z",
    memberActionEndDate: "2026-01-08T00:00:00.000Z",
    bucketDays: 1,
    dayOffsets: [0, 1],
    completedCounts: [1, 2],
    completionFractions: [0.1, 0.2],
  }) satisfies ActionCompletionCurveDto;

const dailyCurves = [curve(1, "Alpha"), curve(2, "Beta")];
const hourlyCurves = dailyCurves.map((daily) => ({
  ...daily,
  dayOffsets: [],
  bucketHours: 1,
  hourOffsets: [0, 1],
}));

let releaseDaily: () => void = () => {};

const api = serveApi(
  routes({
    "GET /analytics/action-completion-curves": ({ request }) => {
      if (new URL(request.url).searchParams.get("granularity") !== "daily") {
        return Response.json(hourlyCurves);
      }
      return new Promise((resolve) => {
        releaseDaily = () => resolve(Response.json(dailyCurves));
      });
    },
  }),
);

const renderChart = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ActionCompletionCurveChart />
    </QueryClientProvider>,
  );

describe("ActionCompletionCurveChart", () => {
  it("keeps the selected action while another granularity loads", async () => {
    renderChart();
    const select = await screen.findByRole<HTMLSelectElement>("combobox");
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
    fireEvent.change(select, { target: { value: "2" } });

    fireEvent.click(screen.getByText("Daily"));
    expect(select.value).toBe("2");
    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(
      screen.queryByText("No action completion curves available."),
    ).toBeNull();

    await act(async () => releaseDaily());
    expect(select.value).toBe("2");
  });

  it("says the load failed instead of showing the empty message", async () => {
    api.alsoServing({
      "GET /analytics/action-completion-curves": () =>
        Response.json({ message: "boom" }, { status: 500 }),
    });
    renderChart();

    expect(
      await screen.findByText("Unable to load action completion curves."),
    ).toBeTruthy();
    expect(
      screen.queryByText("No action completion curves available."),
    ).toBeNull();
  });

  it("keeps a typed duration filter while there are no curves", async () => {
    api.alsoServing({
      "GET /analytics/action-completion-curves": () =>
        Response.json({ message: "boom" }, { status: 500 }),
    });
    renderChart();
    await screen.findByText("Unable to load action completion curves.");

    const min = screen.getByPlaceholderText<HTMLInputElement>("min");
    fireEvent.change(min, { target: { value: "5" } });

    expect(min.value).toBe("5");
  });
});
