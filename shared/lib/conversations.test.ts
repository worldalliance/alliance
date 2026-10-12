import { describe, expect, it } from "bun:test";
import type { ConversationDto, MessageDto } from "../client/types.gen";
import {
  buildGroupConversationTitle,
  canEditConversationInfo,
  canEditConversationMembers,
  canLeaveConversation,
  findMatchingConversation,
  getConversationPreview,
  getJoinedConversations,
  getMessageRequestPreview,
  getParticipantState,
  getPendingInvites,
  isConversationAdmin,
  mergeConversationUnreadPayload,
  mergeConversationUpdate,
  sortConversations,
  updateConversationsForLastMessage,
} from "./conversations";
import { makeConversation, makeParticipant, makeProfile } from "./testFixtures";

describe("isConversationAdmin", () => {
  it("stays false for a member of a group that has an owner", () => {
    const conversation = makeConversation([
      makeParticipant(1, "owner"),
      makeParticipant(2, "member"),
    ]);

    expect(isConversationAdmin(conversation, 2)).toBe(false);
  });

  it("is true for the owner themselves", () => {
    const conversation = makeConversation([makeParticipant(1, "owner")]);

    expect(isConversationAdmin(conversation, 1)).toBe(true);
  });

  it("is true for an admin", () => {
    const conversation = makeConversation([makeParticipant(1, "admin")]);

    expect(isConversationAdmin(conversation, 1)).toBe(true);
  });

  it("is false with no signed-in user", () => {
    const conversation = makeConversation([makeParticipant(1, "owner")]);

    expect(isConversationAdmin(conversation, undefined)).toBe(false);
  });

  it("is false with no conversation", () => {
    expect(isConversationAdmin(null, 1)).toBe(false);
  });
});

describe("getParticipantState", () => {
  it("is invited for an invited participant", () => {
    const conversation = makeConversation([
      makeParticipant(1, "owner"),
      { ...makeParticipant(2, "member"), state: "invited" },
    ]);

    expect(getParticipantState(conversation, 2)).toBe("invited");
  });

  it("is joined for a joined participant", () => {
    const conversation = makeConversation([makeParticipant(1, "member")]);

    expect(getParticipantState(conversation, 1)).toBe("joined");
  });

  it("is null for a user outside the conversation", () => {
    const conversation = makeConversation([makeParticipant(1, "owner")]);

    expect(getParticipantState(conversation, 2)).toBeNull();
  });

  it("is null with no signed-in user", () => {
    const conversation = makeConversation([makeParticipant(1, "owner")]);

    expect(getParticipantState(conversation, undefined)).toBeNull();
  });

  it("is null with no conversation", () => {
    expect(getParticipantState(null, 1)).toBeNull();
  });
});

describe("canEditConversationInfo", () => {
  it("is true for an admin of a group", () => {
    const conversation = makeConversation([
      makeParticipant(1, "owner"),
      makeParticipant(2, "member"),
    ]);

    expect(canEditConversationInfo(conversation, 1)).toBe(true);
  });

  it("is false for a member of a group", () => {
    const conversation = makeConversation([
      makeParticipant(1, "owner"),
      makeParticipant(2, "member"),
    ]);

    expect(canEditConversationInfo(conversation, 2)).toBe(false);
  });

  it("is false for an admin of a community chat", () => {
    const conversation = makeConversation(
      [makeParticipant(1, "admin"), makeParticipant(2, "member")],
      "community",
    );

    expect(canEditConversationInfo(conversation, 1)).toBe(false);
  });

  it("is false for a direct conversation", () => {
    const conversation = makeConversation(
      [makeParticipant(1, "admin"), makeParticipant(2, "member")],
      "direct",
    );

    expect(canEditConversationInfo(conversation, 1)).toBe(false);
  });

  it("is false with no conversation", () => {
    expect(canEditConversationInfo(null, 1)).toBe(false);
  });
});

describe("canEditConversationMembers", () => {
  it("is true for an admin of a group", () => {
    const conversation = makeConversation([
      makeParticipant(1, "owner"),
      makeParticipant(2, "member"),
    ]);

    expect(canEditConversationMembers(conversation, 1)).toBe(true);
  });

  it("is false for a member of a group", () => {
    const conversation = makeConversation([
      makeParticipant(1, "owner"),
      makeParticipant(2, "member"),
    ]);

    expect(canEditConversationMembers(conversation, 2)).toBe(false);
  });

  it("is false for an admin of a community chat", () => {
    const conversation = makeConversation(
      [makeParticipant(1, "admin"), makeParticipant(2, "member")],
      "community",
    );

    expect(canEditConversationMembers(conversation, 1)).toBe(false);
  });

  it("is false for a direct conversation", () => {
    const conversation = makeConversation(
      [makeParticipant(1, "admin"), makeParticipant(2, "member")],
      "direct",
    );

    expect(canEditConversationMembers(conversation, 1)).toBe(false);
  });

  it("is false with no conversation", () => {
    expect(canEditConversationMembers(null, 1)).toBe(false);
  });
});

describe("canLeaveConversation", () => {
  it("is true for a group", () => {
    expect(canLeaveConversation(makeConversation([]))).toBe(true);
  });

  it("is false for a community chat", () => {
    expect(canLeaveConversation(makeConversation([], "community"))).toBe(false);
  });

  it("is false for a direct conversation", () => {
    expect(canLeaveConversation(makeConversation([], "direct"))).toBe(false);
  });

  it("is false with no conversation", () => {
    expect(canLeaveConversation(null)).toBe(false);
  });
});

const makeMessage = ({
  conversationId,
  authorId,
  createdAt = "2026-09-18T00:00:00.000Z",
}: {
  conversationId: number;
  authorId: number;
  createdAt?: string;
}): MessageDto => ({
  id: `m-${conversationId}-${createdAt}`,
  body: "hello",
  attachments: [],
  createdAt,
  deletedAt: null,
  author: makeProfile(authorId),
  conversationId,
});

const conversationWith = (
  id: number,
  overrides: Partial<ConversationDto> = {},
): ConversationDto => ({
  ...makeConversation([
    makeParticipant(1, "owner"),
    makeParticipant(2, "member"),
  ]),
  id,
  ...overrides,
});

const ids = (conversations: ConversationDto[] | null | undefined) =>
  conversations?.map((conversation) => conversation.id);

describe("sortConversations", () => {
  it("puts the latest activity first, falling back to creation time", () => {
    const quiet = conversationWith(1, {
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    const active = conversationWith(2, {
      lastMessage: makeMessage({
        conversationId: 2,
        authorId: 1,
        createdAt: "2026-09-20T00:00:00.000Z",
      }),
    });
    const stale = conversationWith(3, {
      lastMessage: makeMessage({
        conversationId: 3,
        authorId: 1,
        createdAt: "2026-09-18T00:00:00.000Z",
      }),
    });

    expect(ids([stale, quiet, active].sort(sortConversations))).toEqual([
      2, 1, 3,
    ]);
  });
});

describe("getJoinedConversations and getPendingInvites", () => {
  const joined = conversationWith(1);
  const invited = conversationWith(2, {
    participants: [{ ...makeParticipant(2, "member"), state: "invited" }],
  });

  it("splits conversations by the user's participant state", () => {
    expect(ids(getJoinedConversations([joined, invited], 2))).toEqual([1]);
    expect(ids(getPendingInvites([joined, invited], 2))).toEqual([2]);
  });

  it("is undefined with no signed-in user", () => {
    expect(getJoinedConversations([joined], null)).toBeUndefined();
    expect(getPendingInvites([invited], null)).toBeUndefined();
  });
});

describe("buildGroupConversationTitle", () => {
  it("lists up to three names, skipping blank ones", () => {
    expect(buildGroupConversationTitle(["Ada", " ", "Bo", "Cy"])).toBe(
      "Ada, Bo, Cy",
    );
  });

  it("counts the names past three", () => {
    expect(buildGroupConversationTitle(["Ada", "Bo", "Cy", "Di"])).toBe(
      "Ada, Bo, Cy +1 more",
    );
  });
});

describe("findMatchingConversation", () => {
  const direct = conversationWith(1, {
    type: "direct",
    participants: [makeParticipant(1, "member"), makeParticipant(2, "member")],
  });
  const group = conversationWith(2, {
    participants: [
      makeParticipant(1, "owner"),
      makeParticipant(2, "member"),
      makeParticipant(3, "member"),
    ],
  });
  const community = conversationWith(3, {
    type: "community",
    participants: [
      makeParticipant(1, "member"),
      makeParticipant(2, "member"),
      makeParticipant(3, "member"),
    ],
  });

  it("finds the direct conversation with one other user", () => {
    expect(findMatchingConversation([group, direct], 1, [2])).toBe(direct);
  });

  it("finds the group with exactly the other users", () => {
    expect(findMatchingConversation([direct, group], 1, [3, 2])).toBe(group);
  });

  it("skips a community chat with the same users", () => {
    const pair = conversationWith(4, {
      type: "community",
      participants: [
        makeParticipant(1, "member"),
        makeParticipant(2, "member"),
      ],
    });

    expect(findMatchingConversation([community], 1, [2, 3])).toBeNull();
    expect(findMatchingConversation([pair], 1, [2])).toBeNull();
  });

  it("is null when the users differ", () => {
    expect(findMatchingConversation([direct, group], 1, [2, 4])).toBeNull();
  });

  it("is null with no participants to match", () => {
    expect(findMatchingConversation([direct], 1, [])).toBeNull();
  });
});

describe("getConversationPreview", () => {
  it("says there are no messages yet", () => {
    expect(getConversationPreview(conversationWith(1), 1)).toBe(
      "No messages yet",
    );
  });

  it("marks the user's own last message in a direct conversation", () => {
    const conversation = conversationWith(1, {
      type: "direct",
      lastMessage: makeMessage({ conversationId: 1, authorId: 1 }),
    });

    expect(getConversationPreview(conversation, 1)).toBe("you: hello");
    expect(getConversationPreview(conversation, 2)).toBe("hello");
  });

  it("names the author in a group", () => {
    const conversation = conversationWith(1, {
      lastMessage: makeMessage({ conversationId: 1, authorId: 2 }),
    });

    expect(getConversationPreview(conversation, 1)).toBe("User 2: hello");
  });
});

describe("getMessageRequestPreview", () => {
  it("shows the last message, naming the author in a group", () => {
    const lastMessage = makeMessage({ conversationId: 1, authorId: 2 });

    expect(
      getMessageRequestPreview(
        conversationWith(1, { type: "direct", lastMessage }),
      ),
    ).toBe("hello");
    expect(getMessageRequestPreview(conversationWith(1, { lastMessage }))).toBe(
      "User 2: hello",
    );
  });

  it("describes the request when there is no message", () => {
    expect(
      getMessageRequestPreview(conversationWith(1, { type: "direct" })),
    ).toBe("Wants to start a conversation");
    expect(getMessageRequestPreview(conversationWith(1))).toBe(
      "You were invited to a group",
    );
  });
});

describe("updateConversationsForLastMessage", () => {
  it("moves the conversation to the top with the new last message", () => {
    const message = makeMessage({ conversationId: 2, authorId: 1 });
    const updated = updateConversationsForLastMessage(
      [conversationWith(1), conversationWith(2)],
      message,
    );

    expect(ids(updated)).toEqual([2, 1]);
    expect(updated?.[0].lastMessage).toBe(message);
  });

  it("leaves the list alone for an unknown conversation", () => {
    const conversations = [conversationWith(1)];

    expect(
      updateConversationsForLastMessage(
        conversations,
        makeMessage({ conversationId: 9, authorId: 1 }),
      ),
    ).toBe(conversations);
  });
});

describe("mergeConversationUpdate", () => {
  it("merges the update and keeps the list sorted", () => {
    const merged = mergeConversationUpdate(
      [
        conversationWith(1, {
          lastMessage: makeMessage({
            conversationId: 1,
            authorId: 1,
            createdAt: "2026-09-20T00:00:00.000Z",
          }),
        }),
        conversationWith(2),
      ],
      conversationWith(2, { title: "Renamed" }),
    );

    expect(ids(merged)).toEqual([1, 2]);
    expect(merged?.[1].title).toBe("Renamed");
  });

  it("leaves the list alone for an unknown conversation", () => {
    const conversations = [conversationWith(1)];

    expect(mergeConversationUpdate(conversations, conversationWith(9))).toBe(
      conversations,
    );
  });
});

describe("mergeConversationUnreadPayload", () => {
  it("updates the unread count and last message of a listed conversation", () => {
    const lastMessage = makeMessage({
      conversationId: 2,
      authorId: 2,
      createdAt: "2026-09-20T00:00:00.000Z",
    });
    const merged = mergeConversationUnreadPayload(
      [conversationWith(1), conversationWith(2)],
      { conversationId: 2, unreadCount: 3, lastMessage },
      null,
    );

    expect(ids(merged)).toEqual([2, 1]);
    expect(merged?.[0]).toMatchObject({ unreadCount: 3, lastMessage });
  });

  it("merges the payload's conversation without moving it above newer activity", () => {
    const newer = conversationWith(1, {
      lastMessage: makeMessage({
        conversationId: 1,
        authorId: 1,
        createdAt: "2026-09-20T00:00:00.000Z",
      }),
    });
    const older = conversationWith(2, { title: "Renamed" });

    const merged = mergeConversationUnreadPayload(
      [newer, conversationWith(2)],
      { conversationId: 2, unreadCount: 0, conversation: older },
      null,
    );

    expect(ids(merged)).toEqual([1, 2]);
    expect(merged?.[1].title).toBe("Renamed");
    expect(
      ids(
        mergeConversationUnreadPayload(
          [newer],
          { conversationId: 2, unreadCount: 0, conversation: older },
          null,
        ),
      ),
    ).toEqual([1, 2]);
  });

  it("keeps the open conversation read", () => {
    const merged = mergeConversationUnreadPayload(
      [conversationWith(1)],
      { conversationId: 1, unreadCount: 3 },
      1,
    );

    expect(merged?.[0].unreadCount).toBe(0);
  });

  it("adds a conversation the payload carries but the list lacks", () => {
    const merged = mergeConversationUnreadPayload(
      [conversationWith(1)],
      {
        conversationId: 2,
        unreadCount: 1,
        conversation: conversationWith(2, {
          createdAt: "2026-09-20T00:00:00.000Z",
        }),
      },
      null,
    );

    expect(ids(merged)).toEqual([2, 1]);
    expect(merged?.[0].unreadCount).toBe(1);
  });

  it("leaves the list alone for an unknown conversation the payload lacks", () => {
    const conversations = [conversationWith(1)];

    expect(
      mergeConversationUnreadPayload(
        conversations,
        { conversationId: 2, unreadCount: 1 },
        null,
      ),
    ).toBe(conversations);
  });

  it("starts a list from the payload's conversation before one has loaded", () => {
    expect(
      ids(
        mergeConversationUnreadPayload(
          null,
          {
            conversationId: 2,
            unreadCount: 1,
            conversation: conversationWith(2),
          },
          null,
        ),
      ),
    ).toEqual([2]);
  });
});
