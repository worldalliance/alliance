import type { ShareUrlMineDto } from "../client";
import { automaticInviteNote, inviteDestination } from "./copy";
import {
  acceptedInviteCountLabel,
  automaticInviteReason,
  bucketCommunityInvitesByActionability,
  bucketOnetimeInvitesByActionability,
  inviteDestinationLabel,
  inviteDestinationSelection,
  reusableInviteNotes,
} from "./inviteUtils";
import {
  makeCommunity,
  makeCommunityInvite,
  makeOnetimeInvite,
  makeProfile,
  makeShareUrlMine,
} from "./testFixtures";

describe("inviteDestinationLabel", () => {
  const link = (overrides: Partial<ShareUrlMineDto> = {}): ShareUrlMineDto => ({
    id: "share-url-id",
    url: "https://example.com/signup?ref=share-abc",
    label: null,
    duplicate: true,
    sid: "share-abc",
    createdAt: "2026-01-01T00:00:00.000Z",
    signupCount: 0,
    assignmentKind: "open",
    communityId: null,
    communityName: null,
    ...overrides,
  });

  it("labels the primary link as the inviter's own group", () => {
    expect(inviteDestinationLabel(link({ assignmentKind: "automatic" }))).toBe(
      "Group: Your group",
    );
  });

  it("distinguishes automatic from open", () => {
    expect(
      inviteDestinationLabel(link({ assignmentKind: "automatic" })),
    ).not.toBe(inviteDestinationLabel(link({ assignmentKind: "open" })));
  });

  it("labels an open link", () => {
    expect(inviteDestinationLabel(link({ assignmentKind: "open" }))).toBe(
      "Group: Any open group",
    );
  });

  it("names the selected community", () => {
    expect(
      inviteDestinationLabel(
        link({
          assignmentKind: "community",
          communityId: 7,
          communityName: "Bay Area",
        }),
      ),
    ).toBe("Group: Bay Area");
  });

  it("flags a selected community that has been deleted", () => {
    expect(
      inviteDestinationLabel(
        link({
          assignmentKind: "community",
          communityId: null,
          communityName: null,
        }),
      ),
    ).toBe("Group: Deleted — replace this link");
  });
});

describe("inviteDestinationSelection", () => {
  const link = (overrides: Partial<ShareUrlMineDto> = {}): ShareUrlMineDto => ({
    id: "share-url-id",
    url: "https://example.com/signup?ref=share-abc",
    label: null,
    duplicate: true,
    sid: "share-abc",
    createdAt: "2026-01-01T00:00:00.000Z",
    signupCount: 0,
    assignmentKind: "open",
    communityId: null,
    communityName: null,
    ...overrides,
  });

  it("preselects the named group", () => {
    expect(
      inviteDestinationSelection(
        link({
          assignmentKind: "community",
          communityId: 7,
          communityName: "Bay Area",
        }),
      ),
    ).toBe(7);
  });

  it("preselects the open option for an open link", () => {
    expect(inviteDestinationSelection(link({ assignmentKind: "open" }))).toBe(
      null,
    );
  });

  it("selects nothing for a link that never named a group", () => {
    expect(
      inviteDestinationSelection(link({ assignmentKind: "automatic" })),
    ).toBeUndefined();
  });

  it("selects nothing once the named group is deleted", () => {
    // Not the open option: "any open group" is a different destination from
    // "the group I picked is gone".
    expect(
      inviteDestinationSelection(
        link({ assignmentKind: "community", communityId: null }),
      ),
    ).toBeUndefined();
  });
});

describe("reusableInviteNotes", () => {
  const link = (overrides: Partial<ShareUrlMineDto> = {}): ShareUrlMineDto => ({
    id: "share-url-id",
    url: "https://example.com/signup?ref=share-abc",
    label: null,
    duplicate: true,
    sid: "share-abc",
    createdAt: "2026-01-01T00:00:00.000Z",
    signupCount: 0,
    assignmentKind: "open",
    communityId: null,
    communityName: null,
    ...overrides,
  });

  it("always says a change only affects future signups", () => {
    expect(reusableInviteNotes(link()).map((note) => note.text)).toContain(
      inviteDestination.reusable.retargetIsFutureOnly,
    );
  });

  it("warns, not merely informs, when the group is gone", () => {
    const notes = reusableInviteNotes(
      link({ assignmentKind: "community", communityId: null }),
    );
    expect(
      notes.find(
        (note) => note.text === inviteDestination.reusable.deletedGroup,
      )?.tone,
    ).toBe("warning");
  });

  it("says nothing about deletion for a healthy link", () => {
    const notes = reusableInviteNotes(
      link({ assignmentKind: "community", communityId: 7 }),
    );
    expect(notes.every((note) => note.tone === "info")).toBe(true);
    expect(notes).toHaveLength(1);
  });

  it("explains an automatic link, keyed to why it is automatic", () => {
    expect(
      reusableInviteNotes(link({ assignmentKind: "automatic" }))[0].text,
    ).toBe(automaticInviteNote.legacy);
    expect(
      reusableInviteNotes(
        link({ assignmentKind: "automatic", duplicate: false }),
      )[0].text,
    ).toBe(automaticInviteNote.primary);
  });
});

describe("automaticInviteReason", () => {
  const link = (overrides: Partial<ShareUrlMineDto> = {}): ShareUrlMineDto => ({
    id: "share-url-id",
    url: "https://example.com/signup?ref=share-abc",
    label: null,
    duplicate: true,
    sid: "share-abc",
    createdAt: "2026-01-01T00:00:00.000Z",
    signupCount: 0,
    assignmentKind: "automatic",
    communityId: null,
    communityName: null,
    ...overrides,
  });

  it("calls the primary link primary, not legacy", () => {
    // It is minted without a destination and stays that way, so a link made
    // today would be mislabelled as predating the feature.
    expect(automaticInviteReason(link({ duplicate: false }))).toBe("primary");
    expect(automaticInviteNote.primary).not.toMatch(/before/i);
  });

  it("calls an unassigned duplicate legacy", () => {
    expect(automaticInviteReason(link({ duplicate: true }))).toBe("legacy");
  });

  it("gives no reason once the link names a destination", () => {
    expect(automaticInviteReason(link({ assignmentKind: "open" }))).toBeNull();
    expect(
      automaticInviteReason(
        link({ assignmentKind: "community", communityId: 7 }),
      ),
    ).toBeNull();
  });
});

describe("bucketOnetimeInvitesByActionability", () => {
  const invite = makeOnetimeInvite({
    invitee: "Invitee",
    code: "code",
    status: "link_used",
  });

  it("buckets nothing without a user", () => {
    expect(
      bucketOnetimeInvitesByActionability({
        invites: [invite],
        leaderCommunityIds: new Set(),
        userId: undefined,
      }),
    ).toEqual({
      actionable: [],
      unverifiableActionable: [],
      waitingForResponse: [],
      settled: [],
    });
  });

  it("buckets invites for a user", () => {
    expect(
      bucketOnetimeInvitesByActionability({
        invites: [invite],
        leaderCommunityIds: new Set(),
        userId: 1,
      }).settled,
    ).toEqual([invite]);
  });

  it("asks a leader to approve a request to join the group they lead", () => {
    const request = makeOnetimeInvite({
      status: "request_pending",
      community: makeCommunity({ id: 7 }),
      invitingUser: makeProfile(2),
    });
    const buckets = (leaderCommunityIds: Set<number>) =>
      bucketOnetimeInvitesByActionability({
        invites: [request],
        leaderCommunityIds,
        userId: 1,
      });
    expect(buckets(new Set([7])).actionable).toEqual([request]);
    expect(buckets(new Set([8])).waitingForResponse).toEqual([request]);
  });

  it("leaves the user's own unused links for them to send", () => {
    const mine = makeOnetimeInvite({ id: 1, invitingUser: makeProfile(1) });
    const theirs = makeOnetimeInvite({ id: 2, invitingUser: makeProfile(2) });
    const buckets = bucketOnetimeInvitesByActionability({
      invites: [mine, theirs],
      leaderCommunityIds: new Set(),
      userId: 1,
    });
    expect(buckets.unverifiableActionable).toEqual([mine]);
    expect(buckets.waitingForResponse).toEqual([theirs]);
  });
});

describe("bucketCommunityInvitesByActionability", () => {
  it("buckets nothing without a user", () => {
    expect(
      bucketCommunityInvitesByActionability({
        invites: [makeCommunityInvite()],
        userId: undefined,
      }),
    ).toEqual({ actionable: [], waitingForResponse: [], settled: [] });
  });

  it("asks for approval only of requests someone else made", () => {
    const theirs = makeCommunityInvite({
      id: 1,
      status: "request_pending",
      invitingUser: makeProfile(2),
    });
    const mine = makeCommunityInvite({
      id: 2,
      status: "request_pending",
      invitingUser: makeProfile(1),
    });
    const buckets = bucketCommunityInvitesByActionability({
      invites: [theirs, mine],
      userId: 1,
    });
    expect(buckets.actionable).toEqual([theirs]);
    expect(buckets.waitingForResponse).toEqual([mine]);
  });

  it("waits on the invitee and settles answered invites, newest first", () => {
    const older = makeCommunityInvite({
      id: 1,
      status: "invitee_pending",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = makeCommunityInvite({
      id: 2,
      status: "invitee_pending",
      createdAt: "2026-02-01T00:00:00.000Z",
    });
    const settled = (
      [
        "cancelled",
        "invitee_rejected",
        "invitee_accepted",
        "request_rejected",
      ] as const
    ).map((status, index) => makeCommunityInvite({ id: 10 + index, status }));
    const buckets = bucketCommunityInvitesByActionability({
      invites: [older, newer, ...settled],
      userId: 1,
    });
    expect(buckets.waitingForResponse).toEqual([newer, older]);
    expect(buckets.settled).toEqual(settled);
    expect(buckets.actionable).toEqual([]);
  });
});

describe("acceptedInviteCountLabel", () => {
  const loaded = {
    onetimeInvites: [
      makeOnetimeInvite({ id: 1, accepted: true }),
      makeOnetimeInvite({ id: 2, accepted: false }),
    ],
    onetimeInvitesError: false,
    reusableLinks: [
      makeShareUrlMine({ signupCount: 16 }),
      makeShareUrlMine({ signupCount: 3 }),
    ],
    reusableLinksPending: false,
    reusableLinksError: false,
  };

  it("adds multi-use link signups to accepted single-use invites", () => {
    expect(acceptedInviteCountLabel(loaded)).toBe("20");
  });

  it("waits for multi-use links instead of showing a partial count", () => {
    expect(
      acceptedInviteCountLabel({
        ...loaded,
        reusableLinks: [],
        reusableLinksPending: true,
      }),
    ).toBe("...");
  });

  it.each([
    { onetimeInvitesError: true, reusableLinksError: false },
    { onetimeInvitesError: false, reusableLinksError: true },
  ])("shows no count when a list fails to load (%o)", (errors) => {
    expect(acceptedInviteCountLabel({ ...loaded, ...errors })).toBe("—");
  });
});
