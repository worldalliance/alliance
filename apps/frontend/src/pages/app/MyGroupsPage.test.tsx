import type { CommunityDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { IncomingCommunityInvitesProvider } from "@alliance/shared/lib/useIncomingCommunityInvites";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../lib/AuthContext";
import { testAuthUser } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import MyGroupsPage from "./MyGroupsPage";

const failed = async () =>
  Response.json({ message: "Internal server error" }, { status: 500 });

let myGroups = failed;
let publicGroups: CommunityDto[] = [];
let invitedTo: CommunityDto[] = [];

let groupAssignment = async () => Response.json({});

serveApi(
  routes({
    "POST /user/groupAssignment/join": () => groupAssignment(),
    "POST /user/groupAssignment/leave": () => groupAssignment(),
    "GET /community/list/my": () => myGroups(),
    "GET /community/list/public": () => Response.json(publicGroups),
    "GET /community/communityInvites": () =>
      Response.json(
        invitedTo.map((community, index) => ({
          id: index + 1,
          status: "invitee_pending",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          community,
        })),
      ),
  }),
);

beforeEach(() => {
  myGroups = failed;
  publicGroups = [];
  invitedTo = [];
  groupAssignment = async () => Response.json({});
});

afterEach(cleanup);

const group = (id: number, name: string): CommunityDto => ({
  id,
  name,
  description: "",
  photo: null,
  public: true,
  allowMemberInvites: true,
  allowStaffAssignments: true,
  maxCapacity: null,
  users: [],
  leaders: [],
});

const renderPage = ({ undergoingGroupAssignment = false } = {}) => {
  const { wrapper: QueryWrapper } = queryWrapper();
  render(
    <QueryWrapper>
      <ToastProvider>
        <AuthContext.Provider
          value={authValue({
            user: { ...testAuthUser, undergoingGroupAssignment },
          })}
        >
          <IncomingCommunityInvitesProvider>
            <MemoryRouter>
              <MyGroupsPage onSelectCommunity={() => {}} />
            </MemoryRouter>
          </IncomingCommunityInvitesProvider>
        </AuthContext.Provider>
      </ToastProvider>
    </QueryWrapper>,
  );
};

const isDisabled = (text: string) =>
  screen.getByText(text).closest("button")?.disabled;

it("offers a retry instead of an empty group list when groups fail to load", async () => {
  renderPage();
  await screen.findByText("Couldn't load your groups.");
  expect(screen.queryByText("Request assignment")).toBeNull();

  const { promise, resolve } = Promise.withResolvers<Response>();
  myGroups = () => promise;
  fireEvent.click(screen.getByText("Try again"));

  await waitFor(() => expect(isDisabled("Try again")).toBe(true));
  expect(screen.queryByText("Request assignment")).toBeNull();

  resolve(Response.json([]));
  await screen.findByText("Request assignment");
  expect(screen.queryByText("Couldn't load your groups.")).toBeNull();
});

it("holds off joining or accepting a group until your groups load", async () => {
  publicGroups = [group(1, "Public group")];
  invitedTo = [group(2, "Invited group")];
  renderPage();
  await screen.findByText("Couldn't load your groups.");
  await screen.findByText("Invited group");
  expect(isDisabled("Join")).toBe(true);
  expect(isDisabled("Accept")).toBe(true);

  myGroups = async () => Response.json([]);
  fireEvent.click(screen.getByText("Try again"));

  await waitFor(() => expect(isDisabled("Join")).toBe(false));
  expect(isDisabled("Accept")).toBe(false);
});

it("claims no kind of assignment while your groups won't load", async () => {
  renderPage({ undergoingGroupAssignment: true });
  await screen.findByText("Couldn't load your groups.");
  expect(screen.getByText("Cancel group assignment")).toBeTruthy();
  expect(screen.queryByText(/assigning/)).toBeNull();
});

const offline = async (): Promise<Response> => {
  throw new TypeError("Failed to fetch");
};

const requesting = {
  button: "Request assignment",
  undergoingGroupAssignment: false,
  message: "Unable to request group assignment right now.",
};
const cancelling = {
  button: "Cancel assignment",
  undergoingGroupAssignment: true,
  message: "Unable to cancel group assignment right now.",
};

it.each([
  { ...requesting, answer: offline },
  { ...requesting, answer: failed },
  { ...cancelling, answer: offline },
  { ...cancelling, answer: failed },
])(
  "says when $button fails with $answer.name",
  async ({ button, undergoingGroupAssignment, message, answer }) => {
    myGroups = async () => Response.json([]);
    groupAssignment = answer;
    renderPage({ undergoingGroupAssignment });
    fireEvent.click(await screen.findByText(button));
    await screen.findByText(message);
  },
);

it("closes the leave dialog and says when reassignment from it fails", async () => {
  myGroups = async () => Response.json([group(1, "My group")]);
  groupAssignment = offline;
  renderPage();
  fireEvent.click(await screen.findByText("Leave"));
  const dialogButtons = screen.getAllByText("Request reassignment");
  fireEvent.click(dialogButtons[dialogButtons.length - 1]);
  await screen.findByText("Unable to request group assignment right now.");
  expect(screen.queryByText(/Are you sure you want to leave/)).toBeNull();
});
