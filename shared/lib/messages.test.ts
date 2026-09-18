import {
  canEditConversationInfo,
  canEditConversationMembers,
  getParticipantState,
  isConversationAdmin,
} from "./messages";
import { makeConversation, makeParticipant } from "./testFixtures";

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
