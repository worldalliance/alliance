import type {
  CommunityMemberContactInfoDto,
  CommunityUserInfoDto,
  UserActionSummaryDto,
} from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "bun:test";
import { useCommunityMemberInfoAdmin } from "./useCommunityMemberInfoAdmin";

const summary = (id: number): UserActionSummaryDto => ({
  id,
  name: `Action ${id}`,
  status: "member_action",
  weekNumber: id,
  allMembersParticipating: false,
  memberActionDeadline: null,
});

const contactInfo = (id: number): CommunityMemberContactInfoDto => ({
  id,
  timeZone: null,
  phoneNumber: null,
  awayRanges: [],
});

const relation = { actionId: 1, status: "completed" } as const;

let requested: string[] = [];
let progressStatus = 200;

serveApi(
  routes({
    "GET /actions/communityMemberInfo/:communityId/admin": ({ params }) => {
      requested.push(`progress ${params.communityId}`);
      return progressStatus === 200
        ? Response.json({
            actions: [summary(1), summary(2)],
            suites: [],
            users: [{ userId: 7, relations: [relation] }],
          } satisfies CommunityUserInfoDto)
        : Response.json({ message: "Admins only" }, { status: progressStatus });
    },
    "GET /community/memberContactInfo/:communityId/admin": ({ params }) => {
      requested.push(`contactInfo ${params.communityId}`);
      return Response.json([contactInfo(7)]);
    },
  }),
);

beforeEach(() => {
  requested = [];
  progressStatus = 200;
});

it("lists a group's actions most recent first, with relations and contact info by member", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useCommunityMemberInfoAdmin(4), { wrapper });

  await waitFor(() => {
    expect(hook.result.current.progress.isSuccess).toBe(true);
    expect(hook.result.current.contactInfo.isSuccess).toBe(true);
  });
  expect(hook.result.current.progress.data).toEqual({
    actionSummaries: [summary(2), summary(1)],
    userActionRelations: { 7: [relation] },
  });
  expect(hook.result.current.contactInfo.data).toEqual({ 7: contactInfo(7) });
});

it("refetches both after a refresh", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useCommunityMemberInfoAdmin(4), { wrapper });
  await waitFor(() =>
    expect(hook.result.current.contactInfo.isSuccess).toBe(true),
  );
  requested = [];

  await act(() => hook.result.current.refresh());

  expect(requested.sort()).toEqual(["contactInfo 4", "progress 4"]);
});

it("requests nothing without a group", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useCommunityMemberInfoAdmin(null), {
    wrapper,
  });
  await act(() => hook.result.current.refresh());

  expect(requested).toEqual([]);
  expect(hook.result.current.progress.fetchStatus).toBe("idle");
});

it("surfaces a refused load", async () => {
  progressStatus = 403;
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useCommunityMemberInfoAdmin(4), { wrapper });

  await waitFor(() => expect(hook.result.current.progress.isError).toBe(true));
});
