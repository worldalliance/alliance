import { makeProfile } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AuthContext } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import CommunityInvitesLeaderTab, {
  InviteMode,
} from "./CommunityInvitesLeaderTab";

afterEach(cleanup);

let membersStatus = 200;

serveApi(
  routes({
    "GET /community/communityInvites/community/:communityId": () =>
      Response.json([]),
    "GET /user/onetimeInvites/:communityId": () => Response.json([]),
    "GET /user/members": () =>
      membersStatus === 200
        ? Response.json([{ ...makeProfile(2), displayName: "Ana" }])
        : Response.json({}, { status: membersStatus }),
  }),
);

beforeEach(() => {
  membersStatus = 200;
});

const openCurrentMemberPicker = async () => {
  render(
    <AuthContext.Provider value={authValue({ user: testAuthUser })}>
      <SiteAppProvider>
        <ToastProvider>
          <CommunityInvitesLeaderTab
            communityId={1}
            existingMembers={[]}
            setInviteNotifCount={() => {}}
          />
        </ToastProvider>
      </SiteAppProvider>
    </AuthContext.Provider>,
    queryWrapper(),
  );
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
