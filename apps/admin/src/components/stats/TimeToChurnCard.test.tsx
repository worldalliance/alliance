import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import TimeToChurnCard from "./TimeToChurnCard";

let samples: { daysToChurn: number }[] = [];

serveApi(
  routes({ "GET /analytics/time-to-churn": () => Response.json(samples) }),
);

afterEach(() => {
  samples = [];
});

describe("TimeToChurnCard", () => {
  it("bins churned members by whole weeks since signing", async () => {
    samples = [{ daysToChurn: 2 }, { daysToChurn: 6 }, { daysToChurn: 13 }];
    render(<TimeToChurnCard />);

    await screen.findByText("3 churned members");
    expect(screen.getByText("0-1w: 2 members")).toBeTruthy();
    expect(screen.getByText("1-2w: 1 members")).toBeTruthy();
  });

  it("says when no one has churned", async () => {
    render(<TimeToChurnCard />);

    await screen.findByText("No churned members yet.");
  });
});
