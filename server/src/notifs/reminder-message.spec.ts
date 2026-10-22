import {
  ActionListStyle,
  SegmentType,
  UserNameForm,
} from "./notification-content";
import { buildReminderMessage } from "./reminder-message";

describe("buildReminderMessage", () => {
  it("references names and fills every other keyword at send time", async () => {
    const message = await buildReminderMessage({
      template:
        "Hi #{firstname}, you missed #{n} task#{s} in #{action}: #{tasknames}",
      renderText: async (text) =>
        text.replaceAll("#{n}", "2").replaceAll("#{s}", "s"),
      recipient: { id: 1, name: "Ada Lovelace", anonymous: false },
      action: { id: 9, name: "Spring Push" },
      tasks: [
        { id: 3, name: "Call" },
        { id: 4, name: "Write" },
      ],
    });

    expect(message.text).toBe(
      "Hi Ada, you missed 2 tasks in Spring Push: Call, Write",
    );
    expect(message.segments).toEqual([
      "Hi ",
      { type: SegmentType.User, id: 1, name: UserNameForm.First },
      ", you missed 2 tasks in ",
      { type: SegmentType.Action, id: 9 },
      ": ",
      {
        type: SegmentType.ActionList,
        ids: [3, 4],
        style: ActionListStyle.Comma,
      },
    ]);
  });

  it("resolves a plural switch that wraps a referenced keyword", async () => {
    const renderText = jest.fn(async (text: string) =>
      text.replace(/#\{([^|}]*)\|[^}]*\}/g, "$1"),
    );
    const message = await buildReminderMessage({
      template: "#{Do #{tasknames} now|Do these: #{tasknames}}",
      renderText,
      recipient: { id: 1, name: "Ada Lovelace", anonymous: false },
      action: { id: 9, name: "Spring Push" },
      tasks: [{ id: 3, name: "Call rep" }],
    });

    expect(message.text).toBe("Do Call rep now");
    expect(message.segments).toEqual([
      "Do ",
      { type: SegmentType.ActionList, ids: [3], style: ActionListStyle.Comma },
      " now",
    ]);
    expect(renderText).toHaveBeenCalledTimes(1);
  });
});
