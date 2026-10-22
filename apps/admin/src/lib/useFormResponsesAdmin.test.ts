import {
  makeFormResponse,
  makeProfile,
} from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "bun:test";
import { useFormResponsesAdmin } from "./useFormResponsesAdmin";

let requested: string[] = [];
let formStatus = 200;
let responsesStatus = 200;
let shareLinksStatus = 200;
let responsesHeld: Promise<void> = Promise.resolve();

serveApi(
  routes({
    "GET /tasks/adminForm/:id": ({ params }) => {
      requested.push(`form ${params.id}`);
      return formStatus === 200
        ? Response.json({
            id: 4,
            title: "Survey",
            formSnapshotId: 7,
            schema: {},
          })
        : Response.json({}, { status: formStatus });
    },
    "GET /tasks/responses/:id": async ({ params }) => {
      requested.push(`responses ${params.id}`);
      await responsesHeld;
      return responsesStatus === 200
        ? Response.json([
            makeFormResponse({ id: 2, createdAt: "2026-02-01T00:00:00Z" }),
            makeFormResponse({ id: 1, createdAt: "2026-01-01T00:00:00Z" }),
          ])
        : Response.json(
            { message: "Not your form" },
            { status: responsesStatus },
          );
    },
    "GET /actions/shareLinksForForm/:formId": ({ params }) => {
      requested.push(`shareLinks ${params.formId}`);
      if (shareLinksStatus !== 200) {
        return Response.json({}, { status: shareLinksStatus });
      }
      return Response.json([
        { sid: "abc", user: makeProfile(3) },
        { sid: null, user: makeProfile(5) },
      ]);
    },
  }),
);

beforeEach(() => {
  requested = [];
  formStatus = 200;
  responsesStatus = 200;
  shareLinksStatus = 200;
  responsesHeld = Promise.resolve();
});

it("loads the form, its responses oldest first, and its share link ids", async () => {
  const { result } = renderHook(() => useFormResponsesAdmin(4), queryWrapper());

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeNull();
  expect(result.current.referralsError).toBeNull();
  expect(result.current.form?.title).toBe("Survey");
  expect(result.current.responses.map((r) => r.id)).toEqual([1, 2]);
  await waitFor(() =>
    expect(Object.keys(result.current.sidsToUserMap)).toEqual(["abc"]),
  );
  expect(result.current.sidsToUserMap.abc?.id).toBe(3);
});

it("requests nothing without a form id", async () => {
  const { result } = renderHook(
    () => useFormResponsesAdmin(undefined),
    queryWrapper(),
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(result.current.loading).toBe(true);
  expect(requested).toEqual([]);
});

it("fails the load when the server refuses the form", async () => {
  formStatus = 404;
  const { result } = renderHook(() => useFormResponsesAdmin(4), queryWrapper());

  await waitFor(() => expect(result.current.error).toBe("Unable to load form"));
});

it("fails the load when the server refuses the responses", async () => {
  responsesStatus = 500;
  const { result } = renderHook(() => useFormResponsesAdmin(4), queryWrapper());

  await waitFor(() =>
    expect(result.current.error).toBe("Failed to load form responses"),
  );
});

it("keeps the responses up and says so when the share links fail to load", async () => {
  shareLinksStatus = 500;
  const { result } = renderHook(() => useFormResponsesAdmin(4), queryWrapper());

  await waitFor(() =>
    expect(result.current.referralsError).toBe(
      "Failed to load share links, so invited respondents show as anonymous",
    ),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeNull();
  expect(result.current.responses).toHaveLength(2);
  expect(result.current.sidsToUserMap).toEqual({});
});

it("clears the share links error once a refresh loads them", async () => {
  shareLinksStatus = 500;
  const { result } = renderHook(() => useFormResponsesAdmin(4), queryWrapper());
  await waitFor(() => expect(result.current.referralsError).not.toBeNull());

  shareLinksStatus = 200;
  await act(() => result.current.refresh.mutateAsync());

  await waitFor(() => expect(result.current.referralsError).toBeNull());
  expect(result.current.sidsToUserMap.abc?.id).toBe(3);
});

it("shows the server's message when it forbids the responses", async () => {
  responsesStatus = 403;
  const { result } = renderHook(() => useFormResponsesAdmin(4), queryWrapper());

  await waitFor(() => expect(result.current.error).toBe("Not your form"));
});

it("refetches everything on refresh, loading until it lands", async () => {
  const { result } = renderHook(() => useFormResponsesAdmin(4), queryWrapper());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await waitFor(() => expect(requested).toHaveLength(3));

  requested = [];
  let release = () => {};
  responsesHeld = new Promise((resolve) => (release = resolve));
  act(() => result.current.refresh.mutate());

  await waitFor(() => expect(requested).toContain("responses 4"));
  expect(result.current.loading).toBe(true);
  release();
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect([...requested].sort()).toEqual([
    "form 4",
    "responses 4",
    "shareLinks 4",
  ]);
});

it("keeps the loaded responses when a refresh fails", async () => {
  const { result } = renderHook(() => useFormResponsesAdmin(4), queryWrapper());
  await waitFor(() => expect(result.current.responses).toHaveLength(2));

  responsesStatus = 500;
  await act(() =>
    expect(result.current.refresh.mutateAsync()).rejects.toBeDefined(),
  );

  await waitFor(() => expect(result.current.refresh.isError).toBe(true));
  expect(result.current.error).toBeNull();
  expect(result.current.loading).toBe(false);
  expect(result.current.responses).toHaveLength(2);
});

it("still refreshes when only the share links fail", async () => {
  const { result } = renderHook(() => useFormResponsesAdmin(4), queryWrapper());
  await waitFor(() => expect(result.current.responses).toHaveLength(2));

  shareLinksStatus = 500;
  requested = [];
  await act(() => result.current.refresh.mutateAsync());

  expect(requested).toContain("shareLinks 4");
  expect(result.current.error).toBeNull();
});
