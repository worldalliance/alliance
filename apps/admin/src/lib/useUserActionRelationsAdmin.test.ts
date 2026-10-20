import type {
  CreateActionActivityDto,
  UserActionRelationsResponseDto,
} from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useUserActionRelationsAdmin } from "./useUserActionRelationsAdmin";

afterEach(cleanup);

const userId = 3;

const action = {
  id: 7,
  name: "Call your representative",
  status: "member_action",
  weekNumber: 1,
  allMembersParticipating: false,
  memberActionDeadline: null,
} as const;

const relationsWith = (
  status: "todo" | "completed",
): UserActionRelationsResponseDto => ({
  actions: [action],
  suites: [],
  users: [{ userId, relations: [{ actionId: action.id, status }] }],
});

let stored: UserActionRelationsResponseDto;
let loadStatus: number;
let createStatus: number;
let requestedUserIds: string[];
let created: CreateActionActivityDto[];

serveApi(
  routes({
    "GET /actions/action-relations/:userId": ({ params }) => {
      requestedUserIds.push(params.userId);
      return loadStatus === 200
        ? Response.json(stored)
        : Response.json({ message: "Forbidden" }, { status: loadStatus });
    },
    "POST /actions/createActivity": async ({ request }) => {
      if (createStatus !== 200) {
        return Response.json(
          { message: "Activity already exists" },
          { status: createStatus },
        );
      }
      created.push(await request.json());
      stored = relationsWith("completed");
      return Response.json({});
    },
  }),
);

beforeEach(() => {
  stored = relationsWith("todo");
  loadStatus = 200;
  createStatus = 200;
  requestedUserIds = [];
  created = [];
});

const renderLoaded = async () => {
  const view = renderHook(
    () => useUserActionRelationsAdmin(userId),
    queryWrapper(),
  );
  await waitFor(() => expect(view.result.current.query.isSuccess).toBe(true));
  return view;
};

describe("useUserActionRelationsAdmin", () => {
  it("reads the actions and this member's relations to them", async () => {
    const view = await renderLoaded();

    expect(requestedUserIds).toEqual([String(userId)]);
    expect(view.result.current.query.data).toEqual({
      actionSummaries: [action],
      actionRelations: [{ actionId: action.id, status: "todo" }],
    });
  });

  it("reads no relations for a member the response leaves out", async () => {
    stored = { ...stored, users: [] };

    const view = await renderLoaded();

    expect(view.result.current.query.data?.actionRelations).toEqual([]);
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    loadStatus = 403;

    const view = renderHook(
      () => useUserActionRelationsAdmin(userId),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.query.isError).toBe(true));
    expect(view.result.current.query.error).toMatchObject({ statusCode: 403 });
  });

  it("records an activity for the member and reloads their relations", async () => {
    const view = await renderLoaded();

    await view.result.current.createActivity.mutateAsync({
      actionId: action.id,
      type: "user_completed",
    });

    expect(created).toEqual([
      { actionId: action.id, userId, type: "user_completed" },
    ]);
    await waitFor(() =>
      expect(view.result.current.query.data?.actionRelations).toEqual([
        { actionId: action.id, status: "completed" },
      ]),
    );
  });

  it("rejects a refused activity and keeps the relations", async () => {
    createStatus = 400;
    const view = await renderLoaded();

    await expect(
      view.result.current.createActivity.mutateAsync({
        actionId: action.id,
        type: "user_completed",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(requestedUserIds).toEqual([String(userId)]);
  });
});
