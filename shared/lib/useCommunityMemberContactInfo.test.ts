import { renderHook, waitFor } from "@testing-library/react";
import type { CommunityMemberContactInfoDto } from "../client/types.gen";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useCommunityMemberContactInfo } from "./useCommunityMemberContactInfo";

const contactInfo = (id: number): CommunityMemberContactInfoDto => ({
  id,
  timeZone: null,
  phoneNumber: null,
  awayRanges: [],
});

let requested: string[] = [];
let respond: () => Response;

serveApi(
  routes({
    "GET /community/memberContactInfo/:communityId": ({ params }) => {
      requested.push(params.communityId);
      return respond();
    },
  }),
);

beforeEach(() => {
  requested = [];
  respond = () => Response.json([contactInfo(2), contactInfo(3)]);
});

it("keys a leader's members' contact info by user id", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(
    () => useCommunityMemberContactInfo({ communityId: 7, amLeader: true }),
    { wrapper },
  );

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toEqual({
    2: contactInfo(2),
    3: contactInfo(3),
  });
  expect(requested).toEqual(["7"]);
});

it.each([
  { communityId: 7, amLeader: false },
  { communityId: undefined, amLeader: true },
])("requests nothing for %o", async (props) => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useCommunityMemberContactInfo(props), {
    wrapper,
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(hook.result.current.fetchStatus).toBe("idle");
  expect(hook.result.current.data).toBeUndefined();
  expect(requested).toEqual([]);
});

it("fails rather than reading a failed load as no contact info", async () => {
  respond = () => Response.json({ message: "Forbidden" }, { status: 403 });
  const { wrapper } = queryWrapper();

  const hook = renderHook(
    () => useCommunityMemberContactInfo({ communityId: 7, amLeader: true }),
    { wrapper },
  );

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.error).toMatchObject({ statusCode: 403 });
  expect(hook.result.current.data).toBeUndefined();
});
