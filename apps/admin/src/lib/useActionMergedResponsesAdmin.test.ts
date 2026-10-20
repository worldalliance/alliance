import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "bun:test";
import { useActionMergedResponsesAdmin } from "./useActionMergedResponsesAdmin";

const stat = (variantId: number | null, formId: number | null) => ({
  variantId,
  formId,
  name: variantId == null ? "Default" : `Variant ${variantId}`,
  splitValue: null,
  assigned: 0,
  submitted: 0,
});

const field = (id: string) => ({ id, type: "input", kind: "text", label: id });

let stats = [stat(null, 4), stat(2, 5)];
let requested: string[] = [];
let responsesStatus = 200;
let withdrawalsStatus = 200;

serveApi(
  routes({
    "GET /actions/:id/form-variants": () =>
      Response.json({ variants: [], stats }),
    "GET /tasks/slug/:id": ({ params }) => {
      requested.push(`form ${params.id}`);
      return Response.json({
        id: Number(params.id),
        title: `Form ${params.id}`,
        formSnapshotId: 7,
        schema: {
          pages: [
            {
              id: "page-1",
              fields:
                params.id === "4"
                  ? [field("shared")]
                  : [field("shared"), field("variantOnly")],
            },
          ],
        },
      });
    },
    "POST /tasks/responses/byForms": () => {
      requested.push("responses");
      return responsesStatus === 200
        ? Response.json([makeFormResponse({ id: 1, formId: 5 })])
        : Response.json({}, { status: responsesStatus });
    },
    "GET /actions/shareLinksForForm/:formId": () => Response.json([]),
    "GET /actions/withdrawals/byForm/:formId": () =>
      Response.json([], { status: withdrawalsStatus }),
  }),
);

beforeEach(() => {
  stats = [stat(null, 4), stat(2, 5)];
  requested = [];
  responsesStatus = 200;
  withdrawalsStatus = 200;
});

const mount = (query = queryWrapper()) => {
  const view = renderHook(() => useActionMergedResponsesAdmin(1), query);
  return {
    client: query.client,
    hook: () => view.result.current,
    unmount: view.unmount,
  };
};

it("titles the merged form after the default form and appends fields only a variant asks", async () => {
  const { hook } = mount();

  await waitFor(() => expect(hook().loading).toBe(false));
  expect(hook().form).toMatchObject({
    title: "Form 4",
    schema: {
      pages: [
        { fields: [{ id: "shared" }] },
        { fields: [{ id: "variantOnly" }] },
      ],
    },
  });
});

it("caches each variant's schema where the form's own page reads it", async () => {
  const { client, hook } = mount();

  await waitFor(() => expect(hook().loading).toBe(false));
  expect(client.getQueryData(queryKeys.taskForm(5))).toMatchObject({
    title: "Form 5",
  });
});

it("requests nothing more for an action without forms", async () => {
  stats = [stat(null, null)];
  const { hook } = mount();

  await waitFor(() => expect(hook().loading).toBe(false));
  expect(hook().form).toBeNull();
  expect(hook().responses).toEqual([]);
  expect(requested).toEqual([]);
});

it("keeps the loaded responses up when a refresh fails", async () => {
  const { hook } = mount();
  await waitFor(() => expect(hook().responses).toHaveLength(1));

  responsesStatus = 500;
  await act(() => expect(hook().refresh.mutateAsync()).rejects.toBeDefined());

  expect(hook().error).toBeNull();
  expect(hook().loading).toBe(false);
  expect(hook().responses).toHaveLength(1);
});

it("keeps the loaded responses up and fails the refresh when only the withdrawals fail", async () => {
  const { hook } = mount();
  await waitFor(() => expect(hook().loading).toBe(false));

  withdrawalsStatus = 500;
  await act(() => expect(hook().refresh.mutateAsync()).rejects.toBeDefined());

  expect(hook().error).toBeNull();
  expect(hook().responses).toHaveLength(1);
});

it("refreshes only this action's responses, not another set of forms still cached", async () => {
  const query = queryWrapper();
  const first = mount(query);
  await waitFor(() => expect(first.hook().loading).toBe(false));
  first.unmount();

  stats = [stat(null, null)];
  const { hook } = mount(query);
  await waitFor(() => expect(hook().loading).toBe(false));
  requested = [];
  await act(() => hook().refresh.mutateAsync());

  expect(requested).not.toContain("responses");
});
