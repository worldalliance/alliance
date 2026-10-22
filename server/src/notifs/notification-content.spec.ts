import {
  ActionListStyle,
  collectReferenceIds,
  communityDestination,
  DELETED_GROUP_LABEL,
  DELETED_MEMBER_LABEL,
  forumReplyContent,
  group,
  joinMessage,
  member,
  NO_REFERENCES,
  notifMessage,
  parseNotificationContent,
  renderNotificationContent,
  type ResolvedReferences,
  SegmentType,
  UserNameForm,
} from "./notification-content";

const ada = { id: 1, name: "Ada Lovelace", anonymous: false };
const hidden = { id: 2, name: "Grace Hopper", anonymous: true };
const garden = { id: 10, name: "Garden Club" };

const references = (
  overrides: Partial<ResolvedReferences> = {},
): ResolvedReferences => ({ ...NO_REFERENCES, ...overrides });

describe("notifMessage", () => {
  it("keeps interpolated strings as wording and entities as references", () => {
    const message = notifMessage`${member(ada)} left ${"your"} group (${group(garden)})`;

    expect(message.text).toBe("Ada Lovelace left your group (Garden Club)");
    expect(message.segments).toEqual([
      { type: SegmentType.User, id: 1, name: UserNameForm.Full },
      " left your group (",
      { type: SegmentType.Community, id: 10 },
      ")",
    ]);
  });

  it("labels each name form", () => {
    expect(member(ada, UserNameForm.First).label).toBe("Ada");
    expect(member(ada, UserNameForm.Last).label).toBe("Lovelace");
    expect(member(hidden, UserNameForm.Public).label).toBe("Someone");
  });
});

describe("renderNotificationContent", () => {
  const leftGroup = {
    message: notifMessage`${member(ada)} left your group (${group(garden)})`
      .segments,
    destination: communityDestination(garden.id),
  };

  it("renders current labels around the stored wording", () => {
    const rendered = renderNotificationContent({
      content: leftGroup,
      references: references({
        users: new Map([[1, { ...ada, name: "Ada King" }]]),
        communities: new Map([[10, { name: "Seed Library" }]]),
      }),
      count: null,
    });

    expect(rendered).toEqual({
      message: "Ada King left your group (Seed Library)",
      destinationAvailable: true,
    });
  });

  it("labels missing members and groups and drops the destination", () => {
    const rendered = renderNotificationContent({
      content: leftGroup,
      references: references(),
      count: null,
    });

    expect(rendered).toEqual({
      message: `${DELETED_MEMBER_LABEL} left your group (${DELETED_GROUP_LABEL})`,
      destinationAvailable: false,
    });
  });

  it("hides a row whose action is gone", () => {
    expect(
      renderNotificationContent({
        content: { message: [{ type: SegmentType.Action, id: 5 }] },
        references: references(),
        count: null,
      }),
    ).toBeNull();
  });

  it("keeps an anonymous reply author's name hidden", () => {
    const rendered = renderNotificationContent({
      content: forumReplyContent(hidden.id),
      references: references({ users: new Map([[hidden.id, hidden]]) }),
      count: null,
      commentExcerpt: "Reply body",
    });

    expect(rendered?.message).toBe("Someone: Reply body");
  });

  it("throws on an excerpt or update text segment the caller has no text for", () => {
    for (const type of [
      SegmentType.CommentExcerpt,
      SegmentType.ActionUpdateText,
    ] as const) {
      expect(() =>
        renderNotificationContent({
          content: { message: [{ type }] },
          references: references(),
          count: null,
        }),
      ).toThrow();
    }
  });

  it("picks the like variant by count and names the sole participant", () => {
    const content = {
      message: joinMessage([
        { segment: { type: SegmentType.Participant }, label: "Ada" },
        " liked your post",
      ]).segments,
      pluralMessage: joinMessage([
        { segment: { type: SegmentType.Count }, label: "1" },
        " people liked your post",
      ]).segments,
    };
    const render = (count: number) =>
      renderNotificationContent({
        content,
        references: references(),
        count,
        participant: hidden,
      })?.message;

    expect(render(1)).toBe("Someone liked your post");
    expect(render(3)).toBe("3 people liked your post");
  });

  it("numbers a task list only when it has several tasks", () => {
    const render = (ids: number[]) =>
      renderNotificationContent({
        content: {
          message: [
            {
              type: SegmentType.ActionList,
              ids,
              style: ActionListStyle.Numbered,
            },
          ],
        },
        references: references({
          actions: new Map([
            [1, { name: "Call" }],
            [2, { name: "Write" }],
          ]),
        }),
        count: null,
      })?.message;

    expect(render([1])).toBe("Call");
    expect(render([1, 2])).toBe("1. Call\n2. Write");
  });
});

describe("parseNotificationContent", () => {
  it("rejects an unknown segment", () => {
    expect(() =>
      parseNotificationContent({ message: [{ type: "mystery" }] }),
    ).toThrow();
  });
});

describe("collectReferenceIds", () => {
  it("collects ids from both variants and the destination", () => {
    const ids = collectReferenceIds([
      {
        message: [{ type: SegmentType.User, id: 1, name: UserNameForm.Full }],
        pluralMessage: [{ type: SegmentType.Action, id: 7 }],
        destination: communityDestination(10),
      },
    ]);

    expect([...ids.userIds]).toEqual([1]);
    expect([...ids.actionIds]).toEqual([7]);
    expect([...ids.communityIds]).toEqual([10]);
  });
});
