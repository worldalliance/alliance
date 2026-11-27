import { dateToInputValue } from "@alliance/shared/lib/dateInput";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import { millisecondsInDay } from "date-fns/constants";
import { ReminderClickRatePanel } from "./ReminderClickRatePanel";

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

describe("ReminderClickRatePanel", () => {
  it("charts each channel and describes the hovered bar", async () => {
    const { wrapper } = queryWrapper();
    const { container } = render(<ReminderClickRatePanel />, { wrapper });

    await screen.findByText("Email click rate (average by task)");
    expect(
      screen.getByText("No texted reminder data in this range."),
    ).toBeTruthy();

    const bar = container.querySelector("rect[data-bar]");
    if (!bar) throw new Error("no bar");
    fireEvent.mouseEnter(bar);

    const valueOf = (label: string) =>
      screen
        .getByText(label, { selector: "dt span" })
        .closest("div")
        ?.querySelector("dd")?.textContent;
    expect(valueOf("Channel")).toBe("Email");
    expect(valueOf("Click rate")).toBe("25%");
    expect(valueOf("Clicked / sent")).toBe("2/8");
  });

  it("leaves out reminder groups sent before the chosen start date", async () => {
    const { wrapper } = queryWrapper();
    render(<ReminderClickRatePanel />, { wrapper });
    await screen.findByText("Email click rate (average by task)");

    fireEvent.change(screen.getByLabelText("From"), {
      target: {
        value: dateToInputValue(new Date(Date.now() - millisecondsInDay)),
      },
    });

    await screen.findByText(/No sent reminder groups with email or text link/);
  });
});
