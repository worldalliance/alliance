import type { CommunityInviteDto } from "@alliance/shared/client";
import { makeCommunity, makeProfile } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import CommunityInvitesLeaderTab, {
  InviteMode,
} from "./CommunityInvitesLeaderTab";

const invite: CommunityInviteDto = {
  id: 5,
  status: "invitee_pending",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  community: makeCommunity({ id: 7 }),
  invitedUser: makeProfile(4),
};

const ana = { ...makeProfile(2), displayName: "Ana" };

let communityInvites: () => Response;
let respondToDelete: () => Response | Promise<Response>;
let respondToCreate: () => Response;
let created: unknown[] = [];
let membersStatus = 200;

serveApi(
  routes({
    "GET /community/communityInvites/community/:communityId": () =>
      communityInvites(),
    "DELETE /community/communityInvites/:inviteId": () => respondToDelete(),
    "POST /community/communityInvites/create": async ({ request }) => {
      created.push(await request.json());
      return respondToCreate();
    },
    "GET /user/onetimeInvites/:communityId": () => Response.json([]),
    "GET /user/members": () =>
      membersStatus === 200
        ? Response.json([ana])
        : Response.json({}, { status: membersStatus }),
  }),
);

beforeEach(() => {
  communityInvites = () => Response.json([invite]);
  respondToDelete = () => new Response(null, { status: 200 });
  respondToCreate = () => Response.json({ ...invite, id: 6, invitedUser: ana });
  created = [];
  membersStatus = 200;
});

const renderTab = () => {
  const { wrapper: QueryWrapper } = queryWrapper();
  render(
    <QueryWrapper>
      <ToastProvider>
        <AuthContext.Provider value={authValue({ user: testAuthUser })}>
          <MemoryRouter>
            <SiteAppProvider>
              <CommunityInvitesLeaderTab
                communityId={7}
                existingMembers={[]}
                setInviteNotifCount={() => {}}
              />
            </SiteAppProvider>
          </MemoryRouter>
        </AuthContext.Provider>
      </ToastProvider>
    </QueryWrapper>,
  );
};

it("drops a deleted invite from the list", async () => {
  renderTab();
  fireEvent.click(await screen.findByText("Delete"));

  await waitFor(() => expect(screen.queryByText("User 4")).toBeNull());
});

it("sends one delete however often Delete is clicked while it is pending", async () => {
  const { promise, resolve } = Promise.withResolvers<Response>();
  let deletes = 0;
  respondToDelete = () => {
    deletes += 1;
    return promise;
  };
  renderTab();
  const button = await screen.findByText("Delete");
  fireEvent.click(button);
  fireEvent.click(button);

  resolve(new Response(null, { status: 200 }));
  await waitFor(() => expect(screen.queryByText("User 4")).toBeNull());
  expect(deletes).toBe(1);
  expect(screen.queryByText("Failed to delete invite")).toBeNull();
});

it("keeps an invite the server refuses to delete, and says so", async () => {
  respondToDelete = () =>
    Response.json({ message: "Forbidden" }, { status: 403 });
  renderTab();
  fireEvent.click(await screen.findByText("Delete"));

  await screen.findByText("Failed to delete invite");
  expect(screen.getByText("User 4")).toBeDefined();
});

it("says when the existing member invites fail to load", async () => {
  communityInvites = () =>
    Response.json({ message: "Forbidden" }, { status: 403 });
  renderTab();

  await screen.findByText("Failed to load existing member invites");
});

const openCurrentMemberPicker = async () => {
  renderTab();
  fireEvent.click(
    screen.getAllByRole("button", { name: InviteMode.NewMember })[0],
  );
  fireEvent.click(
    await screen.findByRole("button", { name: InviteMode.CurrentMember }),
  );
};

it("offers the members to invite", async () => {
  await openCurrentMemberPicker();
  fireEvent.change(await screen.findByRole("textbox"), {
    target: { value: "An" },
  });

  expect(await screen.findByRole("button", { name: "Ana" })).toBeTruthy();
});

it("says the members failed to load instead of offering none", async () => {
  membersStatus = 500;
  await openCurrentMemberPicker();

  expect(await screen.findByText("Failed to load users.")).toBeTruthy();
});

const inviteAna = async () => {
  await openCurrentMemberPicker();
  await screen.findByText("User 4");
  fireEvent.change(await screen.findByRole("textbox"), {
    target: { value: "Ana" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Ana" }));
  fireEvent.click(screen.getByText("Create invite"));
};

it("lists an invite to a current member once it is created", async () => {
  await inviteAna();

  await screen.findByRole("link", { name: "Ana" });
  expect(created).toEqual([{ invitedUserId: 2, communityId: 7 }]);
});

it("shows the server's reason when it refuses an invite", async () => {
  respondToCreate = () =>
    Response.json({ message: "User already invited" }, { status: 400 });
  await inviteAna();

  await screen.findByText("User already invited");
});
