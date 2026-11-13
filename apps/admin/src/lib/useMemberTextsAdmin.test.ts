import type { NeedsReplyMemberDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { useNeedsReplyAdmin, useNeedsReplyCount } from "./useMemberTextsAdmin";

const member = (userId: number): NeedsReplyMemberDto => ({
  userId,
  name: `Member ${userId}`,
  lastMessageBody: "Hello?",
  waitingSince: "2026-11-01T00:00:00.000Z",
});

let respond: () => Response | Promise<Response>;

serveApi(
  routes({
    "GET /mms-threads/needs-reply": () => respond(),
  }),
);

beforeEach(() => {
  respond = () => Response.json([member(1), member(2)]);
});

it("counts the members waiting", async () => {
  const view = renderHook(useNeedsReplyCount, queryWrapper());

  await waitFor(() => expect(view.result.current).toBe(2));
});

it("counts nobody while the list loads", () => {
  respond = () => new Promise(() => {});

  const view = renderHook(useNeedsReplyCount, queryWrapper());

  expect(view.result.current).toBe(0);
});

it("gives no count when the list has never loaded", async () => {
  respond = () => Response.json({ message: "down" }, { status: 500 });

  const view = renderHook(useNeedsReplyCount, queryWrapper());

  await waitFor(() => expect(view.result.current).toBeNull());
});

it("keeps the last count when a later poll fails", async () => {
  const { wrapper, client } = queryWrapper();
  const view = renderHook(
    () => ({ count: useNeedsReplyCount(), list: useNeedsReplyAdmin() }),
    { wrapper },
  );
  await waitFor(() => expect(view.result.current.count).toBe(2));
  respond = () => Response.json({ message: "down" }, { status: 500 });

  await client.refetchQueries({ queryKey: queryKeys.needsReplyAdmin() });

  await waitFor(() => expect(view.result.current.list.isError).toBe(true));
  expect(view.result.current.count).toBe(2);
});
