import type { CommunityMemberContactInfoDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "bun:test";
import { useMemberContactInfoAdmin } from "./useMemberContactInfoAdmin";

const contactInfo = (id: number): CommunityMemberContactInfoDto => ({
  id,
  timeZone: null,
  phoneNumber: `+1555000000${id}`,
  awayRanges: [],
});

let respond: () => Response;

serveApi(
  routes({
    "GET /community/memberContactInfo": () => respond(),
  }),
);

beforeEach(() => {
  respond = () => Response.json([contactInfo(1), contactInfo(2)]);
});

it("reads every member's contact info keyed by user id", async () => {
  const view = renderHook(() => useMemberContactInfoAdmin(), queryWrapper());

  await waitFor(() =>
    expect(view.result.current.data).toEqual({
      1: contactInfo(1),
      2: contactInfo(2),
    }),
  );
});

it("surfaces a refused load as an error carrying its status", async () => {
  respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

  const view = renderHook(() => useMemberContactInfoAdmin(), queryWrapper());

  await waitFor(() => expect(view.result.current.isError).toBe(true));
  expect(view.result.current.error).toMatchObject({ statusCode: 403 });
});
