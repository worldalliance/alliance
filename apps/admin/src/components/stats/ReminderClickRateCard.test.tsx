import { dateToInputValue } from "@alliance/shared/lib/dateInput";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import { millisecondsInDay } from "date-fns/constants";
import ReminderClickRateCard from "./ReminderClickRateCard";

serveApi(
  routes({
    "GET /analytics/reminder-group-click-rates": () =>
      Response.json([
        {
          date: new Date(Date.now() - 3 * millisecondsInDay).toISOString(),
          reminderGroupId: 1,
          reminderGroupName: "First nudge",
          actionId: 3,
          actionName: "Call a rep",
          emailClickRate: 0.25,
          textClickRate: 0,
          emailSentCount: 8,
          emailClickedCount: 2,
          textSentCount: 0,
          textClickedCount: 0,
        },
      ]),
  }),
);

describe("ReminderClickRateCard", () => {
  it("charts each channel and describes the hovered bar", async () => {
    const { wrapper } = queryWrapper();
    const { container } = render(<ReminderClickRateCard />, { wrapper });

    await screen.findByText("Email Click Rate (Avg by Action)");
    expect(
      screen.getByText("No texted reminder data in this range."),
    ).toBeTruthy();

    const bar = container.querySelector("rect.cursor-pointer");
    if (!bar) throw new Error("no bar");
    fireEvent.mouseEnter(bar);

    expect(screen.getByText("Channel").nextSibling?.textContent).toBe("email");
    expect(screen.getByText("Click rate").nextSibling?.textContent).toBe("25%");
    expect(screen.getByText("Clicked / Sent").nextSibling?.textContent).toBe(
      "2/8",
    );
  });

  it("leaves out reminder groups sent before the chosen start date", async () => {
    const { wrapper } = queryWrapper();
    render(<ReminderClickRateCard />, { wrapper });
    await screen.findByText("Email Click Rate (Avg by Action)");

    const from = screen
      .getByText("From")
      .closest("div")
      ?.querySelector("input");
    if (!from) throw new Error("no From input");
    fireEvent.change(from, {
      target: {
        value: dateToInputValue(new Date(Date.now() - millisecondsInDay)),
      },
    });

    await screen.findByText(/No sent reminder groups with email\/text link/);
  });
});
