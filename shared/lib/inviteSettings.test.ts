import { act, renderHook } from "@testing-library/react";
import type { OnetimeInviteDto, ShareUrlMineDto } from "../client";
import {
  onetimeInviteSettings,
  reusableInviteSettings,
  useInviteSettingsDraft,
  type InviteSettingsTarget,
} from "./inviteSettings";

const link = (overrides: Partial<ShareUrlMineDto> = {}): ShareUrlMineDto => ({
  id: "share-url-id",
  url: "https://example.com/signup?ref=share-abc",
  label: "Instagram bio",
  duplicate: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  signupCount: 0,
  assignmentKind: "community",
  communityId: 4,
  communityName: "Group four",
  ...overrides,
});

const target = (
  overrides: Partial<InviteSettingsTarget["name"]> = {},
): InviteSettingsTarget => {
  const settings = reusableInviteSettings({
    link: link(),
    updateInvite: () => Promise.resolve(),
  });
  return {
    ...settings,
    name: { ...settings.name, ...overrides },
    onDelete: () => Promise.resolve(),
  };
};

const community = { id: 9, name: "Group nine" };

describe("reusableInviteSettings", () => {
  const settingsFor = (overrides: Partial<ShareUrlMineDto>) =>
    reusableInviteSettings({
      link: link(overrides),
      updateInvite: () => Promise.resolve(),
    });

  it("titles an unlabeled primary link and keeps it from being deleted", () => {
    const settings = settingsFor({ duplicate: false, label: null });

    expect(settings.title).toBe("Primary invite");
    expect(settings.delete.enabled).toBe(false);
  });

  it("titles an unlabeled duplicate link and lets it be deleted", () => {
    const settings = settingsFor({ label: null });

    expect(settings.title).toBe("Untitled link");
    expect(settings.delete.enabled).toBe(true);
  });

  it("sends only the fields that changed, under the link's own names", async () => {
    const updateInvite = jest.fn(() => Promise.resolve());
    const settings = reusableInviteSettings({ link: link(), updateInvite });

    await settings.onSave({ name: "Newsletter" });
    await settings.onSave({ communityId: null });

    expect(updateInvite.mock.calls).toEqual([
      [{ id: "share-url-id", label: "Newsletter" }],
      [{ id: "share-url-id", communityId: null }],
    ]);
  });
});

describe("onetimeInviteSettings", () => {
  const invite: OnetimeInviteDto = {
    id: 12,
    invitee: "Ada",
    code: "abc",
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "link_unused",
  };

  it("links to the invite's signup page and requires a name", () => {
    const settings = onetimeInviteSettings({
      invite,
      baseUrl: "https://example.com/",
      updateInvite: () => Promise.resolve(),
    });

    expect(settings.url).toBe("https://example.com/signup?ref=abc");
    expect(settings.name.required).toBe(true);
    expect(settings.destination.current).toBeNull();
  });

  it("saves a new name as the invitee", async () => {
    const updateInvite = jest.fn(() => Promise.resolve());
    const settings = onetimeInviteSettings({
      invite,
      baseUrl: "https://example.com",
      updateInvite,
    });

    await settings.onSave({ name: "Grace", communityId: 4 });

    expect(updateInvite.mock.calls).toEqual([
      [{ inviteId: 12, invitee: "Grace", communityId: 4 }],
    ]);
  });
});

describe("useInviteSettingsDraft", () => {
  const render = (draftTarget = target()) =>
    renderHook(() =>
      useInviteSettingsDraft({
        target: draftTarget,
        leaderCommunities: [community],
      }),
    ).result;

  it("starts clean, offering the led groups before the open choice", () => {
    const draft = render();

    expect(draft.current.dirty).toBe(false);
    expect(draft.current.changes).toEqual({});
    expect(draft.current.options.map((option) => option.value)).toEqual([
      9,
      null,
    ]);
  });

  it("trims the name and leaves an untouched destination out of the changes", () => {
    const draft = render();

    act(() => draft.current.setName("  Newsletter  "));

    expect(draft.current.dirty).toBe(true);
    expect(draft.current.changes).toEqual({ name: "Newsletter" });
  });

  it("treats a whitespace-only name as missing only when one is required", () => {
    const optional = render();
    const required = render(target({ required: true }));

    act(() => optional.current.setName("   "));
    act(() => required.current.setName("   "));

    expect(optional.current.nameMissing).toBe(false);
    expect(required.current.nameMissing).toBe(true);
  });

  it("includes a newly chosen destination", () => {
    const draft = render();

    act(() => draft.current.setDestination(9));

    expect(draft.current.changes).toEqual({ communityId: 9 });
  });
});
