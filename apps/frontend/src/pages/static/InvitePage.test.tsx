import type { OnetimeInviteStatus } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  makeCommunity,
  makeOnetimeInvite,
} from "@alliance/shared/lib/testFixtures";
import { pending, type Pending } from "@alliance/shared/lib/testing/pending";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import * as ytEmbedModule from "../../components/AllianceIntroYouTubeEmbed";
import { AuthContext } from "../../lib/AuthContext";
import { InviteSessionProvider } from "../../site/invite/InviteSession";
import { authValue } from "../../testing/authValue";
import InvitePage from "./InvitePage";

let status: OnetimeInviteStatus;
let invites: Pending<Response>[] | null;

serveApi(
  routes({
    "GET /user/referrerProfile/:code": () =>
      Response.json({
        kind: "user",
        displayName: "Jane Smith",
        profilePicture: null,
      }),
    "GET /user/onetimeInvite/:code": ({ params }) =>
      invites
        ? pending(invites)
        : Response.json(
            makeOnetimeInvite({
              code: params.code,
              invitee: "Sam",
              status,
              community: makeCommunity(),
            }),
          ),
    "POST /user/nmembers": () => Response.json({ count: 1000 }),
    "GET /user/slug/:id": () =>
      Response.json({ profilePicture: null, displayName: "" }),
  }),
);

afterEach(() => sessionStorage.clear());

beforeEach(() => {
  status = "link_unused";
  invites = null;
  // The landing body's player reaches for a YouTube thumbnail on render.
  jest.spyOn(ytEmbedModule, "default").mockImplementation(() => <></>);
});

const visit = () => {
  const { client, wrapper } = queryWrapper();
  render(
    <MemoryRouter initialEntries={["/invite?ref=CODE"]}>
      <AuthContext.Provider value={authValue({})}>
        <InviteSessionProvider>
          <InvitePage />
        </InviteSessionProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
    { wrapper },
  );
  return client;
};

it("names the inviter, the invitee and the group", async () => {
  visit();
  expect(await screen.findByText(/Jane Smith/)).toBeTruthy();
  expect(screen.getByText(/^Hi Sam, I invite you/)).toBeTruthy();
  expect(screen.getByText(/added to my smaller Alliance group/)).toBeTruthy();
});

it("names no one on a used invite", async () => {
  status = "link_used";
  const client = visit();
  await waitFor(() => expect(client.isFetching()).toBe(0));
  expect(screen.getByText(/^I invite you/)).toBeTruthy();
  expect(screen.queryByText(/Jane Smith/)).toBeNull();
  expect(screen.queryByText(/added to my smaller Alliance group/)).toBeNull();
});

it("names no inviter until it knows the invite is usable", async () => {
  invites = [];
  const client = visit();
  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.referrerProfile("CODE"))?.status,
    ).toBe("success"),
  );
  expect(screen.queryByText(/Jane Smith/)).toBeNull();
});
