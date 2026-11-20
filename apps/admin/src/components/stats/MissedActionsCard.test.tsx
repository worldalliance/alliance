import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MissedActionsCard from "./MissedActionsCard";

let missedActionsStatus = 200;
let missedActionsRequests = 0;

serveApi(
  routes({
    "GET /analytics/missed-actions": () => {
      missedActionsRequests += 1;
      return missedActionsStatus === 200
        ? Response.json({
            missedLastAction: [
              { userId: 7, name: "Ada Member", lastActionName: "Call a rep" },
            ],
            missedLastTwoActions: [],
          })
        : Response.json({}, { status: missedActionsStatus });
    },
  }),
);

afterEach(() => {
  missedActionsStatus = 200;
  missedActionsRequests = 0;
});

describe("MissedActionsCard", () => {
  it("lists each group's members on load", async () => {
    render(<MissedActionsCard />, queryWrapper());

    const member = await screen.findByRole("link", { name: "Ada Member" });
    expect(member.getAttribute("href")).toBe("/member/7");
    expect(screen.getByText("Missed last two actions")).toBeTruthy();
    expect(screen.getByText("No members.")).toBeTruthy();
  });

  it("reloads on each Refresh click", async () => {
    render(<MissedActionsCard />, queryWrapper());
    await screen.findByRole("link", { name: "Ada Member" });
    expect(missedActionsRequests).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(missedActionsRequests).toBe(2));
  });

  it("says the load failed", async () => {
    missedActionsStatus = 500;
    render(<MissedActionsCard />, queryWrapper());

    await screen.findByText("Unable to load missed actions.");
  });

  it("says the load failed when a reload fails", async () => {
    render(<MissedActionsCard />, queryWrapper());
    await screen.findByRole("link", { name: "Ada Member" });

    missedActionsStatus = 500;
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await screen.findByText("Unable to load missed actions.");
    expect(screen.queryByRole("link", { name: "Ada Member" })).toBeNull();
  });
});
