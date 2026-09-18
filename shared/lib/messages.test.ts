import {
  ConversationDto,
  ParticipantDto,
  ParticipantRole,
  ProfileDto,
} from "@alliance/shared/client";
import { getParticipantState, isConversationAdmin } from "./messages";

const makeProfile = (id: number): ProfileDto => ({
  id,
  admin: false,
  staff: false,
  ambassador: false,
  profilePicture: null,
  profileDescription: null,
  anonymous: false,
  displayName: `User ${id}`,
  hasActiveContract: true,
  isCommunityLeader: false,
});

const makeParticipant = (
  id: number,
  role: ParticipantRole,
): ParticipantDto => ({
  role,
  state: "joined",
  user: makeProfile(id),
});

const makeConversation = (participants: ParticipantDto[]): ConversationDto => ({
  id: 1,
  createdAt: "2026-09-17T00:00:00.000Z",
  updatedAt: "2026-09-17T00:00:00.000Z",
  type: "multiple",
  title: "Group",
  participants,
  hasUnread: false,
  isMessageRequest: false,
  unreadCount: 0,
});

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
