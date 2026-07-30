import type { ShareUrlMineDto } from "../client";
import { automaticInviteNote, inviteDestination } from "./copy";
import {
  automaticInviteReason,
  inviteDestinationLabel,
  inviteDestinationSelection,
  reusableInviteNotes,
} from "./inviteUtils";

describe("inviteDestinationLabel", () => {
  const link = (overrides: Partial<ShareUrlMineDto> = {}): ShareUrlMineDto => ({
    id: "share-url-id",
    url: "https://example.com/signup?ref=share-abc",
    label: null,
    duplicate: true,
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
