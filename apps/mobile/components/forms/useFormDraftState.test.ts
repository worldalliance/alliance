import type { FormSchema } from "@alliance/common/forms/form-schema";
import { useFormSchemaMaps } from "@alliance/shared/forms/useFormSchemaMaps";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react";
import { memoryAsyncStorage } from "../../lib/memoryAsyncStorage";
import { useFormDraftState } from "./useFormDraftState";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        { id: "name", type: "input", kind: "text", label: "Name" },
        { id: "zone", type: "input", kind: "timezone", label: "Zone" },
        {
          id: "phone",
          type: "input",
          kind: "phone",
          label: "Phone",
          autoExtractUserData: true,
        },
      ],
    },
  ],
  outputViews: [],
};

let serverAnswers: Record<string, string> = {};
let syncedAnswers: unknown[] = [];

serveApi(
  routes({
    "GET /tasks/formDraft/:id": () =>
      Response.json({
        draft: {
          formId: 1,
          actionId: 1,
          formSnapshotId: 1,
          answers: serverAnswers,
          publicAnswers: {},
          currentPageIndex: 0,
          updatedAt: "2026-02-02T00:00:00.000Z",
        },
      }),
    "PUT /tasks/formDraft/:id": async ({ request }) => {
      const body = await request.json();
      syncedAnswers.push(body.answers);
      return Response.json({ ...body, updatedAt: "2026-02-03T00:00:00.000Z" });
    },
  }),
);

const renderDraftState = ({
  timeZone = "UTC",
  syncDraftToServer = true,
}: { timeZone?: string; syncDraftToServer?: boolean } = {}) =>
  renderHook(
    ({ edited }) => {
      const maps = useFormSchemaMaps({
        schema,
        userDefaultPublic: true,
        timeZone,
        profilePhoneNumber: "+14155552671",
      });
      return useFormDraftState({
        ...maps,
        formId: 1,
        actionId: 1,
        formSnapshotId: 1,
        persistKey: "key",
        syncDraftToServer,
        readOnly: false,
        edited,
      });
    },
    { initialProps: { edited: false }, ...queryWrapper() },
  );

const storedAnswers = async () =>
  JSON.parse((await AsyncStorage.getItem("form:1:key")) ?? "{}").formData;

beforeEach(() => {
  memoryAsyncStorage();
  serverAnswers = { name: "Server" };
  syncedAnswers = [];
});
afterEach(() => jest.restoreAllMocks());

it("restores an answer left at its default from the current default", async () => {
  const first = renderDraftState({ syncDraftToServer: false });
  await waitFor(() => expect(first.result.current.formData.zone).toBe("UTC"));
  act(() =>
    first.result.current.setFormData((prev) => ({ ...prev, name: "Saved" })),
  );
  await waitFor(async () =>
    expect(await storedAnswers()).toEqual({ name: "Saved" }),
  );
  first.unmount();

  const second = renderDraftState({
    timeZone: "Asia/Kolkata",
    syncDraftToServer: false,
  });

  await waitFor(() =>
    expect(second.result.current.formData).toEqual({
      name: "Saved",
      zone: "Asia/Kolkata",
      phone: "+14155552671",
    }),
  );
});

it("syncs every answer, a prefilled number still at the member's as empty", async () => {
  const hook = renderDraftState();
  await waitFor(() => expect(hook.result.current.formData.name).toBe("Server"));

  hook.rerender({ edited: true });
  act(() =>
    hook.result.current.setFormData((prev) => ({ ...prev, name: "Edited" })),
  );

  await waitFor(
    () =>
      expect(syncedAnswers.at(-1)).toEqual({
        name: "Edited",
        zone: "UTC",
        phone: "",
      }),
    { timeout: 3000 },
  );
});

it("reads another device's empty prefilled number as the member's current one", async () => {
  serverAnswers = { name: "Server", phone: "" };

  const hook = renderDraftState();

  await waitFor(() => expect(hook.result.current.formData.name).toBe("Server"));
  expect(hook.result.current.formData.phone).toBe("+14155552671");
});
