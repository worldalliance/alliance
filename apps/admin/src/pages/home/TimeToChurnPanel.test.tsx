import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, render, screen } from "@testing-library/react";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { TimeToChurnPanel } from "./TimeToChurnPanel";

let samples: { daysToChurn: number }[] = [];
let status = 200;
let message = "Internal server error";

serveApi(
  routes({
    "GET /analytics/time-to-churn": () =>
      status === 200
        ? Response.json(samples)
        : Response.json({ message }, { status }),
  }),
);

afterEach(() => {
  samples = [];
  status = 200;
  message = "Internal server error";
});

describe("TimeToChurnPanel", () => {
  it("bins churned members by whole weeks since signing", async () => {
    samples = [{ daysToChurn: 2 }, { daysToChurn: 6 }, { daysToChurn: 13 }];
    render(<TimeToChurnPanel />, queryWrapper());

    await screen.findByText(/^3 churned members/);
    expect(screen.getByText("0 to 1 weeks: 2 churned members")).toBeTruthy();
    expect(screen.getByText("1 to 2 weeks: 1 churned member")).toBeTruthy();
  });

  it("says when no one has churned", async () => {
    render(<TimeToChurnPanel />, queryWrapper());

    await screen.findByText("No churned members yet");
  });

  it("says the load failed rather than that no one has churned", async () => {
    status = 500;
    render(<TimeToChurnPanel />, queryWrapper());

    await screen.findByText("Couldn't load time to churn");
    expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
    expect(screen.queryByText("No churned members yet")).toBeNull();
  });

  it("keeps the shown histogram when a refetch fails, and says it may be stale", async () => {
    samples = [{ daysToChurn: 2 }];
    const query = queryWrapper();
    render(<TimeToChurnPanel />, query);
    await screen.findByText("0 to 1 weeks: 1 churned member");

    status = 500;
    await act(() =>
      query.client.refetchQueries({
        queryKey: queryKeys.timeToChurnSamplesAdmin(),
      }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Couldn't refresh time to churn.",
    );
    expect(screen.getByText("0 to 1 weeks: 1 churned member")).toBeTruthy();
    expect(screen.queryByText("Couldn't load time to churn")).toBeNull();
  });

  it("says why a refused load failed", async () => {
    status = 403;
    message = "Admins only";
    render(<TimeToChurnPanel />, queryWrapper());

    await screen.findByText("Admins only");
  });
});
