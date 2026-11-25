import type { FormSchema } from "@alliance/common/forms/form-schema";
import { type FormResponseDto } from "@alliance/shared/client";
import { type DraftFetchState } from "@alliance/shared/forms/draftFetchState";
import { serializeStoredFormDraft } from "@alliance/shared/forms/formDrafts";
import { useFormSchemaMaps } from "@alliance/shared/forms/useFormSchemaMaps";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useFormDraftState } from "./useFormDraftState";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        { id: "name", type: "input", kind: "text", label: "Name" },
        {
          id: "story",
          type: "input",
          kind: "text",
          label: "Story",
          output: { output: true },
        },
        { id: "zone", type: "input", kind: "timezone", label: "Zone" },
        {
          id: "agree",
          type: "input",
          kind: "checkbox",
          label: "Agree",
          defaultValue: true,
        },
        {
          id: "phone",
          type: "input",
          kind: "phone",
          label: "Phone",
          autoExtractUserData: true,
        },
      ],
    },
    {
      id: "p2",
      fields: [{ id: "x", type: "display", kind: "text", text: "" }],
    },
  ],
  outputViews: [],
};

const storageKey = "form:1:key";

const storeDraft = (
  formData: Record<string, string>,
  page = 0,
  syncedUpdatedAt: string | null = null,
) =>
  window.localStorage.setItem(
    storageKey,
    serializeStoredFormDraft({
      formData,
      publicAnswers: {},
      currentPageIndex: page,
      syncedUpdatedAt,
    }),
  );

let draftFetched = false;
let serverAnswers: Record<string, string> = {};
let syncedAnswers: unknown[] = [];
let renders: { settled: boolean; name: unknown }[] = [];

serveApi(
  routes({
    "GET /tasks/formDraft/:id": () => {
      draftFetched = true;
      return Response.json({
        draft: {
          formId: 1,
          actionId: 1,
          formSnapshotId: 1,
          answers: serverAnswers,
          publicAnswers: { story: false },
          currentPageIndex: 1,
          updatedAt: "2026-02-02T00:00:00.000Z",
        },
      });
    },
    "PUT /tasks/formDraft/:id": async ({ request }) => {
      const body = await request.json();
      syncedAnswers.push(body.answers);
      return Response.json({ ...body, updatedAt: "2026-02-03T00:00:00.000Z" });
    },
  }),
);

const renderDraftState = (
  props: {
    draftFormResponse?: FormResponseDto | null;
    guestDraftFetch?: DraftFetchState;
    syncDraftToServer?: boolean;
    timeZone?: string;
    profilePhoneNumber?: string | null;
  } = {},
) =>
  renderHook(
    ({
      draftFormResponse,
      guestDraftFetch,
      syncDraftToServer,
      timeZone = "UTC",
      profilePhoneNumber = null,
    }) => {
      const maps = useFormSchemaMaps({
        schema,
        userDefaultPublic: true,
        timeZone,
        profilePhoneNumber,
      });
      const state = useFormDraftState({
        ...maps,
        formId: 1,
        actionId: 1,
        formSnapshotId: 1,
        persistKey: "key",
        readOnly: false,
        draftFormResponse,
        guestDraftFetch,
        syncDraftToServer,
        userDefaultPublic: true,
      });
      renders.push({ settled: state.draftSettled, name: state.formData.name });
      return state;
    },
    { initialProps: props, ...queryWrapper() },
  );

beforeEach(() => {
  window.localStorage.clear();
  draftFetched = false;
  serverAnswers = { name: "Server" };
  syncedAnswers = [];
  renders = [];
});

it("restores the stored draft over a guest draft", () => {
  storeDraft({ name: "Local" }, 1);

  const hook = renderDraftState({
    draftFormResponse: makeFormResponse({ answers: { name: "Guest" } }),
  });

  expect(hook.result.current.formData.name).toBe("Local");
  expect(hook.result.current.currentPageIndex).toBe(1);
});

it("keeps the stored draft when a guest draft arrives after mount", () => {
  storeDraft({ name: "Local" });

  const hook = renderDraftState();
  hook.rerender({
    draftFormResponse: makeFormResponse({ answers: { name: "Guest" } }),
  });

  expect(hook.result.current.formData.name).toBe("Local");
});

it("applies a guest draft that arrives after mount", () => {
  const hook = renderDraftState();

  hook.rerender({
    draftFormResponse: makeFormResponse({ answers: { name: "Guest" } }),
  });

  expect(hook.result.current.formData.name).toBe("Guest");
});

it("ignores a guest draft that arrives after the member starts editing", () => {
  const hook = renderDraftState();

  act(() => {
    hook.result.current.markEdited();
    hook.result.current.setFormData({ name: "Typed" });
  });
  hook.rerender({
    draftFormResponse: makeFormResponse({ answers: { name: "Guest" } }),
  });

  expect(hook.result.current.formData.name).toBe("Typed");
});

it("applies a guest draft after a visit that left no answers", () => {
  renderDraftState().unmount();

  const hook = renderDraftState({
    draftFormResponse: makeFormResponse({ answers: { name: "Guest" } }),
  });

  expect(hook.result.current.formData.name).toBe("Guest");
});

it("keeps a guest answer the member set back to its default", () => {
  const guestDraft = makeFormResponse({ answers: { zone: "Asia/Kolkata" } });
  const first = renderDraftState({ draftFormResponse: guestDraft });
  act(() => {
    first.result.current.markEdited();
    first.result.current.setFormData((prev) => ({ ...prev, zone: "UTC" }));
  });
  first.unmount();

  const hook = renderDraftState({ draftFormResponse: guestDraft });

  expect(hook.result.current.formData.zone).toBe("UTC");
});

it("saves answers and page to localStorage", () => {
  const hook = renderDraftState();

  act(() => {
    hook.result.current.setFormData({ name: "Saved" });
    hook.result.current.setCurrentPageIndex(1);
  });

  const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
  expect(stored.formData).toEqual({ name: "Saved" });
  expect(stored.currentPageIndex).toBe(1);
});

it("restores an answer left at its default from the current default", () => {
  const first = renderDraftState({ timeZone: "America/New_York" });
  act(() =>
    first.result.current.setFormData((prev) => ({ ...prev, name: "Saved" })),
  );
  first.unmount();

  const hook = renderDraftState({ timeZone: "Asia/Kolkata" });

  expect(hook.result.current.formData).toEqual({
    name: "Saved",
    zone: "Asia/Kolkata",
    agree: true,
  });
});

it("restores a prefilled number the member left alone as their current one", () => {
  const first = renderDraftState({ profilePhoneNumber: "+14155550100" });
  act(() =>
    first.result.current.setFormData((prev) => ({ ...prev, name: "Saved" })),
  );
  first.unmount();

  const hook = renderDraftState({ profilePhoneNumber: "+14155552671" });

  expect(hook.result.current.formData).toEqual({
    name: "Saved",
    zone: "UTC",
    agree: true,
    phone: "+14155552671",
  });
});

it("stores a share choice only while it differs from the default", () => {
  const hook = renderDraftState();
  const storedPublicAnswers = () =>
    JSON.parse(window.localStorage.getItem(storageKey) ?? "{}").publicAnswers;

  act(() => hook.result.current.setPublicAnswer("story", false));
  expect(hook.result.current.publicAnswers.story).toBe(false);
  expect(storedPublicAnswers()).toEqual({ story: false });

  act(() => hook.result.current.setPublicAnswer("story", true));
  expect(hook.result.current.publicAnswers.story).toBe(true);
  expect(storedPublicAnswers()).toEqual({});
});

it("restores a draft another device saved to the account", async () => {
  storeDraft({ name: "Local" }, 0, "2026-01-01T00:00:00.000Z");

  const hook = renderDraftState({ syncDraftToServer: true });

  await waitFor(() => expect(hook.result.current.formData.name).toBe("Server"));
  expect(hook.result.current.currentPageIndex).toBe(1);
  expect(hook.result.current.publicAnswers.story).toBe(false);
});

it("syncs every answer, a prefilled number still at the member's as empty", async () => {
  const hook = renderDraftState({
    syncDraftToServer: true,
    profilePhoneNumber: "+14155552671",
  });
  await waitFor(() => expect(hook.result.current.formData.name).toBe("Server"));

  act(() => {
    hook.result.current.markEdited();
    hook.result.current.setFormData((prev) => ({ ...prev, name: "Edited" }));
  });

  await waitFor(
    () =>
      expect(syncedAnswers.at(-1)).toEqual({
        name: "Edited",
        zone: "UTC",
        agree: true,
        phone: "",
      }),
    { timeout: 3000 },
  );
});

it("reads another device's empty prefilled number as the member's current one", async () => {
  storeDraft({ phone: "+14155550100" }, 0, "2026-01-01T00:00:00.000Z");
  serverAnswers = { name: "Server", phone: "" };

  const hook = renderDraftState({
    syncDraftToServer: true,
    profilePhoneNumber: "+14155552671",
  });

  await waitFor(() => expect(hook.result.current.formData.name).toBe("Server"));
  expect(hook.result.current.formData.phone).toBe("+14155552671");
});

it("settles the draft in the same render that restores another device's answers", async () => {
  storeDraft({ name: "Local" }, 0, "2026-01-01T00:00:00.000Z");

  const hook = renderDraftState({ syncDraftToServer: true });

  expect(hook.result.current.draftSettled).toBe(false);
  await waitFor(() => expect(hook.result.current.draftSettled).toBe(true));
  expect(renders).not.toContainEqual({ settled: true, name: "Local" });
  expect(hook.result.current.formData.name).toBe("Server");
});

it("is settled at once without syncing", () => {
  const hook = renderDraftState();

  expect(hook.result.current.draftSettled).toBe(true);
});

it("settles a fetched guest draft in the same render that applies it", () => {
  const hook = renderDraftState({
    guestDraftFetch: { settled: false, failed: false },
  });
  expect(hook.result.current.draftSettled).toBe(false);

  hook.rerender({
    draftFormResponse: makeFormResponse({ answers: { name: "Guest" } }),
    guestDraftFetch: { settled: true, failed: false },
  });

  expect(renders).not.toContainEqual({ settled: true, name: undefined });
  expect(hook.result.current.draftSettled).toBe(true);
  expect(hook.result.current.formData.name).toBe("Guest");
});

it("reports a failed guest draft fetch", () => {
  const hook = renderDraftState({
    guestDraftFetch: { settled: false, failed: true },
  });

  expect(hook.result.current.draftFailed).toBe(true);
});

it("unsettles when syncing turns on after mount, until the synced answers land", async () => {
  storeDraft({ name: "Local" }, 0, "2026-01-01T00:00:00.000Z");
  const hook = renderDraftState();
  renders = [];

  hook.rerender({ syncDraftToServer: true });

  await waitFor(() => expect(hook.result.current.formData.name).toBe("Server"));
  expect(renders).not.toContainEqual({ settled: true, name: "Local" });
  expect(hook.result.current.draftSettled).toBe(true);
});

it("unsettles when syncing turns on after a guest draft has settled", async () => {
  storeDraft({ name: "Local" }, 0, "2026-01-01T00:00:00.000Z");
  const guestDraftFetch = { settled: true, failed: false };
  const hook = renderDraftState({ guestDraftFetch });
  await waitFor(() => expect(hook.result.current.draftSettled).toBe(true));
  renders = [];

  hook.rerender({ guestDraftFetch, syncDraftToServer: true });

  await waitFor(() => expect(hook.result.current.formData.name).toBe("Server"));
  expect(renders).not.toContainEqual({ settled: true, name: "Local" });
  expect(hook.result.current.draftSettled).toBe(true);
});

it("unsettles when a guest draft fetch starts after the synced draft has settled", async () => {
  const hook = renderDraftState({ syncDraftToServer: true });
  await waitFor(() => expect(hook.result.current.draftSettled).toBe(true));

  hook.rerender({
    syncDraftToServer: true,
    guestDraftFetch: { settled: false, failed: false },
  });

  expect(hook.result.current.draftSettled).toBe(false);
});

it("keeps the local draft when the account's draft is this device's own save", async () => {
  storeDraft({ name: "Local" }, 0, "2026-02-02T00:00:00.000Z");

  const hook = renderDraftState({ syncDraftToServer: true });

  await waitFor(() => expect(draftFetched).toBe(true));
  await act(async () => {});
  expect(hook.result.current.formData.name).toBe("Local");
  expect(hook.result.current.currentPageIndex).toBe(0);
});
