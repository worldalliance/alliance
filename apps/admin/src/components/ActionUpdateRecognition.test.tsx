import { render, screen } from "@testing-library/react";
import { NotificationHeldBanner } from "./ActionUpdateRecognition";

describe("NotificationHeldBanner", () => {
  it("says the notifications are on hold, and why", () => {
    render(
      <NotificationHeldBanner reason="Write at least one group's result." />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("notifications are on hold");
    expect(alert.textContent).toContain("Write at least one group's result.");
  });
});
