import { renderHook } from "@testing-library/react";
import { queryKeys } from "./queryKeys";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useContractSignature } from "./useContractSignature";
import { meQuery } from "./useMe";

const DATE = "2026-03-10T12:00:00.000Z";

let refusal: number | null = null;
let meRequests = 0;

serveApi(
  routes({
    "POST /contract/sign/:id": () =>
      refusal === null
        ? Response.json({ date: DATE })
        : Response.json({ message: "no" }, { status: refusal }),
    "POST /contract/suspend": () =>
      refusal === null
        ? Response.json({ date: DATE })
        : Response.json({ message: "no" }, { status: refusal }),
    "GET /auth/me": () => {
      meRequests += 1;
      return Response.json({ user: { id: 1, hasActiveContract: true } });
    },
  }),
);

beforeEach(() => {
  refusal = null;
  meRequests = 0;
});

const setup = () => {
  const { client, wrapper } = queryWrapper();
  client.setQueryData(queryKeys.myVisibilityContext(), {
    firstContractSignedAt: null,
  });
  client.setQueryData(queryKeys.allianceMemberCount(), 1200);
  const { result } = renderHook(() => useContractSignature(), { wrapper });
  const visibilityStale = () =>
    client.getQueryState(queryKeys.myVisibilityContext())?.isInvalidated;
  const memberCountStale = () =>
    client.getQueryState(queryKeys.allianceMemberCount())?.isInvalidated;
  return {
    client,
    signature: result.current,
    visibilityStale,
    memberCountStale,
  };
};

describe("useContractSignature", () => {
  it("reloads the member, the visibility context and the count after signing", async () => {
    const { client, signature, visibilityStale, memberCountStale } = setup();

    const signed = await signature.sign({ contractId: 2, signedName: "Jane" });

    expect(signed).toEqual({ ok: true, value: { date: DATE } });
    expect(meRequests).toBe(1);
    expect(client.getQueryData(meQuery.queryKey)?.user.hasActiveContract).toBe(
      true,
    );
    expect(visibilityStale()).toBe(true);
    expect(memberCountStale()).toBe(true);
  });

  it("reloads the member and the count, not the visibility context, after suspending", async () => {
    const { signature, visibilityStale, memberCountStale } = setup();

    const suspended = await signature.suspend();

    expect(suspended).toEqual({ ok: true, value: { date: DATE } });
    expect(meRequests).toBe(1);
    expect(visibilityStale()).toBe(false);
    expect(memberCountStale()).toBe(true);
  });

  it("leaves the caches alone when the server refuses", async () => {
    refusal = 400;
    const { signature, visibilityStale, memberCountStale } = setup();

    const signed = await signature.sign({ contractId: 2, signedName: "Jane" });
    const suspended = await signature.suspend();

    expect(signed.ok).toBe(false);
    expect(suspended.ok).toBe(false);
    expect(meRequests).toBe(0);
    expect(visibilityStale()).toBe(false);
    expect(memberCountStale()).toBe(false);
  });
});
