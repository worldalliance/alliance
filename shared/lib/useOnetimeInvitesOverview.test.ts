import { act, renderHook, waitFor } from "@testing-library/react";
import type { OnetimeInviteDto } from "../client/types.gen";
import { makeOnetimeInvite } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useOnetimeInvitesOverview } from "./useOnetimeInvitesOverview";

let serverInvites: OnetimeInviteDto[];
let created: unknown[];
let createResponse: () => Response;
let createHeld: Promise<void>;

serveApi(
  routes({
    "GET /user/onetimeInvites/overview": () => Response.json(serverInvites),
    "POST /user/onetimeInvite/create": async ({ request }) => {
      created.push(await request.json());
      await createHeld;
      return createResponse();
    },
  }),
);

beforeEach(() => {
  serverInvites = [makeOnetimeInvite({ id: 1 }), makeOnetimeInvite({ id: 2 })];
  created = [];
  createHeld = Promise.resolve();
  createResponse = () =>
    Response.json(makeOnetimeInvite({ id: 3, invitee: "Ada" }));
});

const renderLoaded = async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useOnetimeInvitesOverview(), { wrapper });
  await waitFor(() => expect(hook.result.current.invites).toHaveLength(2));
  return hook;
};

it("loads the user's one-time invites", async () => {
  const hook = await renderLoaded();

  expect(hook.result.current.invites.map((i) => i.id)).toEqual([1, 2]);
});

it("creates an invite and puts it first in the list", async () => {
  const hook = await renderLoaded();

  let invite: OnetimeInviteDto | undefined;
  await act(async () => {
    invite = await hook.result.current.createInvite({
      invitee: "Ada",
      communityId: 7,
    });
  });

  expect(created).toEqual([{ invitee: "Ada", communityId: 7 }]);
  expect(invite?.id).toBe(3);
  await waitFor(() =>
    expect(hook.result.current.invites.map((i) => i.id)).toEqual([3, 1, 2]),
  );
});

it("a refused create rejects with the server's error and leaves the list alone", async () => {
  createResponse = () =>
    Response.json({ message: "Invitee is required" }, { status: 400 });
  const hook = await renderLoaded();

  let failure: unknown;
  await act(async () => {
    await hook.result.current
      .createInvite({ invitee: "" })
      .catch((error: unknown) => (failure = error));
  });

  expect(failure).toMatchObject({ message: "Invitee is required" });
  expect(hook.result.current.invites.map((i) => i.id)).toEqual([1, 2]);
});

it("reports a create in flight", async () => {
  const held = Promise.withResolvers<void>();
  createHeld = held.promise;
  const hook = await renderLoaded();
  expect(hook.result.current.isCreatingInvite).toBe(false);

  let creation: Promise<OnetimeInviteDto> | undefined;
  act(() => {
    creation = hook.result.current.createInvite({ invitee: "Ada" });
  });

  await waitFor(() => expect(hook.result.current.isCreatingInvite).toBe(true));
  await act(async () => {
    held.resolve();
    await creation;
  });
  await waitFor(() => expect(hook.result.current.isCreatingInvite).toBe(false));
});
