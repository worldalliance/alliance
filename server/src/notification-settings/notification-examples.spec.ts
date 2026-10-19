import { KIND_EXAMPLE } from "./notification-examples";
import { NotificationKind } from "./notification-kind";

describe("KIND_EXAMPLE", () => {
  const examples = Object.fromEntries(
    Object.values(NotificationKind).map((kind) => [kind, KIND_EXAMPLE[kind]()]),
  );

  it("fills in each reminder's keywords with the sample action", () => {
    expect(examples[NotificationKind.ActionReminders]).toBe(
      "You have 2 days left to complete 1 Alliance task",
    );
    expect(examples[NotificationKind.GroupMembersWithUncompletedTasks]).toMatch(
      "3 of your Alliance group members have 2 days left to complete their upcoming task. See here: http",
    );
  });

  it("renders referenced names and groups as they read in the inbox", () => {
    expect(examples[NotificationKind.CommentsAndReplies]).toBe(
      "Jordan Ellis: Count me in for Saturday!",
    );
    expect(examples[NotificationKind.RemovedFromCommunityForLeader]).toBe(
      "Jordan Ellis removed Maya Rowan from your group (Climate Hawks)",
    );
    expect(examples[NotificationKind.Likes]).toBe(
      "Jordan Ellis liked your post: Photos from the beach cleanup",
    );
  });

  it("leaves no keyword or blank example", () => {
    for (const example of Object.values(examples)) {
      expect(example).not.toBe("");
      expect(example).not.toContain("#{");
      expect(example).not.toContain("[err]");
    }
  });
});
