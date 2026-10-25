import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import MissedActionsCard from "./MissedActionsCard";

let missedActionsStatus = 200;

serveApi(
  routes({
    "GET /analytics/missed-actions": () =>
      missedActionsStatus === 200
        ? Response.json({
            missedLastAction: [
              { userId: 7, name: "Ada Member", lastActionName: "Call a rep" },
            ],
            missedLastTwoActions: [],
          })
        : Response.json({}, { status: missedActionsStatus }),
  }),
);

afterEach(() => {
  missedActionsStatus = 200;
});

describe("MissedActionsCard", () => {
  it("lists each group's members once requested", async () => {
    render(<MissedActionsCard />);
    expect(screen.queryByText("Missed last action")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View actions" }));

    const member = await screen.findByRole("link", { name: "Ada Member" });
    expect(member.getAttribute("href")).toBe("/member/7");
    expect(screen.getByText("Missed last two actions")).toBeTruthy();
    expect(screen.getByText("No members.")).toBeTruthy();
  });

  it("says the load failed", async () => {
    missedActionsStatus = 500;
    render(<MissedActionsCard />);

    fireEvent.click(screen.getByRole("button", { name: "View actions" }));

    await screen.findByText("Unable to load missed actions.");
  });
});
