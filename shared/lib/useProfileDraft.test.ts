import { act, renderHook, waitFor } from "@testing-library/react";
import type { ProfileDto } from "../client";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useProfileDraft } from "./useProfileDraft";

const saved: unknown[] = [];

const api = serveApi(
  routes({
    "POST /user/update": async ({ request }) => {
      const body: unknown = await request.json();
      saved.push(body);
      return Response.json({ id: 7 });
    },
  }),
);

const profile: ProfileDto = {
  id: 7,
  admin: false,
  staff: false,
  ambassador: false,
  anonymous: false,
  hasActiveContract: false,
  isCommunityLeader: false,
  displayName: "Ada",
  profileDescription: null,
  profilePicture: "https://example.com/ada.png",
};

type Props = { userId: number; profile: ProfileDto };

const render = () =>
  renderHook(
    ({ userId, profile }: Props) =>
      useProfileDraft({ userId, profile, isMe: true }),
    {
      initialProps: { userId: 7, profile },
      wrapper: queryWrapper().wrapper,
    },
  );

beforeEach(() => {
  saved.length = 0;
});

describe("useProfileDraft", () => {
  it("starts from the profile being viewed", () => {
    const draft = render().result;

    expect(draft.current.name).toBe("Ada");
    expect(draft.current.bio).toBe("");
    expect(draft.current.avatarUrl).toBe("https://example.com/ada.png");
  });

  it("saves the draft without resending an unchanged photo, then closes the form", async () => {
    const draft = render().result;
    act(() => {
      draft.current.setIsEditing(true);
      draft.current.setBio("Hello");
    });

    let result: Awaited<ReturnType<typeof draft.current.save>> | undefined;
    await act(async () => {
      result = await draft.current.save();
    });

    expect(result?.ok).toBe(true);
    expect(saved).toEqual([{ name: "Ada", profileDescription: "Hello" }]);
    expect(draft.current.isEditing).toBe(false);
  });

  it("sends a changed photo", async () => {
    const draft = render().result;
    act(() => {
      draft.current.setIsEditing(true);
      draft.current.setAvatarUrl("data:image/png;base64,AAAA");
    });

    await act(() => draft.current.save());

    expect(saved).toEqual([
      {
        name: "Ada",
        profileDescription: "",
        profilePicture: "data:image/png;base64,AAAA",
      },
    ]);
  });

  it("keeps the form open when the save is refused", async () => {
    api.alsoServing({
      "POST /user/update": () =>
        Response.json({ message: "nope" }, { status: 400 }),
    });
    const draft = render().result;
    act(() => draft.current.setIsEditing(true));

    let result: Awaited<ReturnType<typeof draft.current.save>> | undefined;
    await act(async () => {
      result = await draft.current.save();
    });

    expect(result?.ok).toBe(false);
    expect(draft.current.isEditing).toBe(true);
    await waitFor(() => expect(draft.current.isSaving).toBe(false));
  });

  it("discards the draft on cancel", () => {
    const draft = render().result;
    act(() => {
      draft.current.setIsEditing(true);
      draft.current.setName("Grace");
    });

    act(() => draft.current.cancel());

    expect(draft.current.isEditing).toBe(false);
    expect(draft.current.name).toBe("Ada");
  });

  it("keeps the draft through a refetch while editing", () => {
    const { result, rerender } = render();
    act(() => {
      result.current.setIsEditing(true);
      result.current.setName("Grace");
    });

    rerender({ userId: 7, profile: { ...profile, displayName: "Ada L." } });

    expect(result.current.name).toBe("Grace");
  });

  it("closes the form on moving to another member", () => {
    const { result, rerender } = render();
    act(() => result.current.setIsEditing(true));

    rerender({ userId: 8, profile: { ...profile, id: 8 } });

    expect(result.current.isEditing).toBe(false);
  });
});
