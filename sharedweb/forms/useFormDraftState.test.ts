import type { FormSchema } from "@alliance/common/forms/form-schema";
import { type FormResponseDto } from "@alliance/shared/client";
import { serializeStoredFormDraft } from "@alliance/shared/forms/formDrafts";
import { useFormSchemaMaps } from "@alliance/shared/forms/useFormSchemaMaps";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
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

serveApi(
  routes({
    "GET /tasks/formDraft/:id": () => {
      draftFetched = true;
      return Response.json({
        draft: {
          formId: 1,
          actionId: 1,
          formSnapshotId: 1,
          answers: { name: "Server" },
          publicAnswers: { story: false },
          currentPageIndex: 1,
          updatedAt: "2026-02-02T00:00:00.000Z",
        },
      });
    },
  }),
);

const renderDraftState = (
  props: {
    draftFormResponse?: FormResponseDto | null;
    syncDraftToServer?: boolean;
  } = {},
) =>
  renderHook(
    ({ draftFormResponse, syncDraftToServer }) => {
      const maps = useFormSchemaMaps({
        schema,
        userDefaultPublic: true,
        timeZone: "UTC",
      });
      return useFormDraftState({
        ...maps,
        formId: 1,
        actionId: 1,
        formSnapshotId: 1,
        persistKey: "key",
        readOnly: false,
        draftFormResponse,
        syncDraftToServer,
        userDefaultPublic: true,
      });
    },
    { initialProps: props },
  );

beforeEach(() => {
  window.localStorage.clear();
  draftFetched = false;
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

it("keeps the local draft when the account's draft is this device's own save", async () => {
  storeDraft({ name: "Local" }, 0, "2026-02-02T00:00:00.000Z");

  const hook = renderDraftState({ syncDraftToServer: true });

  await waitFor(() => expect(draftFetched).toBe(true));
  await act(async () => {});
  expect(hook.result.current.formData.name).toBe("Local");
  expect(hook.result.current.currentPageIndex).toBe(0);
});
