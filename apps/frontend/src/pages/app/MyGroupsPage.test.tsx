import type { CommunityDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../lib/AuthContext";
import { testAuthUser, testUser } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import MyGroupsPage from "./MyGroupsPage";

const failed = async () =>
  Response.json({ message: "Internal server error" }, { status: 500 });

let myGroups = failed;
let publicGroups: CommunityDto[] = [];
let invitedTo: CommunityDto[] = [];
let invites = async () =>
  Response.json(
    invitedTo.map((community, index) => ({
      id: index + 1,
      status: "invitee_pending",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      community,
    })),
  );
const defaultInvites = invites;

let groupAssignment = async () => Response.json({});

const api = serveApi(
  routes({
    "POST /user/groupAssignment/join": () => groupAssignment(),
    "POST /user/groupAssignment/leave": () => groupAssignment(),
    "GET /community/list/my": () => myGroups(),
    "GET /community/list/public": () => Response.json(publicGroups),
    "GET /community/communityInvites": () => invites(),
  }),
);

beforeEach(() => {
  myGroups = failed;
  publicGroups = [];
  invitedTo = [];
  invites = defaultInvites;
  groupAssignment = async () => Response.json({});
});

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

const renderPage = ({
  undergoingGroupAssignment = false,
  onSelectCommunity = () => {},
}: {
  undergoingGroupAssignment?: boolean;
  onSelectCommunity?: (communityId: number | null | undefined) => void;
} = {}) => {
  const { wrapper: QueryWrapper } = queryWrapper();
  render(
    <QueryWrapper>
      <ToastProvider>
        <AuthContext.Provider
          value={authValue({
            user: { ...testAuthUser, undergoingGroupAssignment },
          })}
        >
          <MemoryRouter>
            <MyGroupsPage onSelectCommunity={onSelectCommunity} />
          </MemoryRouter>
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

it.each([{ answer: offline }, { answer: failed }])(
  "says when leaving a group fails with $answer.name",
  async ({ answer }) => {
    myGroups = async () => Response.json([group(1, "My group")]);
    api.alsoServing({ "POST /community/:communityId/leave": answer });
    renderPage();
    fireEvent.click(await screen.findByText("Leave"));
    fireEvent.click(screen.getByText("Leave group"));
    await screen.findByText("Unable to leave that group right now.");
  },
);

it("holds Leave group while its request is in flight", async () => {
  myGroups = async () => Response.json([group(1, "My group")]);
  const { promise, resolve } = Promise.withResolvers<Response>();
  api.alsoServing({ "POST /community/:communityId/leave": () => promise });
  renderPage();
  fireEvent.click(await screen.findByText("Leave"));
  fireEvent.click(screen.getByText("Leave group"));
  await waitFor(() => expect(isDisabled("Leave group")).toBe(true));

  myGroups = async () => Response.json([]);
  resolve(Response.json({}));
  await waitFor(() => expect(screen.queryByText("My group")).toBeNull());
});

it("frees Leave group once a failed leave answers", async () => {
  myGroups = async () => Response.json([group(1, "My group")]);
  const { promise, resolve } = Promise.withResolvers<Response>();
  api.alsoServing({ "POST /community/:communityId/leave": () => promise });
  renderPage();
  fireEvent.click(await screen.findByText("Leave"));
  fireEvent.click(screen.getByText("Leave group"));
  await waitFor(() => expect(isDisabled("Leave group")).toBe(true));

  resolve(await failed());
  await waitFor(() => expect(isDisabled("Leave group")).toBe(false));
});

it.each([requesting, cancelling])(
  "holds $button while its request is in flight",
  async ({ button, undergoingGroupAssignment }) => {
    myGroups = async () => Response.json([]);
    const { promise, resolve } = Promise.withResolvers<Response>();
    groupAssignment = () => promise;
    renderPage({ undergoingGroupAssignment });
    fireEvent.click(await screen.findByText(button));
    await waitFor(() => expect(isDisabled(button)).toBe(true));

    resolve(Response.json({}));
    await waitFor(() => expect(isDisabled(button)).toBe(false));
  },
);

it("offers a retry when your group invites fail to load", async () => {
  myGroups = async () => Response.json([]);
  invites = failed;
  renderPage();
  await screen.findByText("Couldn't load your group invites.");

  invitedTo = [group(2, "Invited group")];
  invites = defaultInvites;
  fireEvent.click(screen.getByText("Try again"));

  await screen.findByText("Invited group");
  expect(screen.queryByText("Couldn't load your group invites.")).toBeNull();
});

it("opens the group once its invite is accepted", async () => {
  myGroups = async () => Response.json([]);
  invitedTo = [group(2, "Invited group")];
  api.alsoServing({
    "POST /community/communityInvites/:inviteId/accept": () =>
      Response.json({}),
  });
  const onSelectCommunity = jest.fn();
  renderPage({ onSelectCommunity });
  fireEvent.click(await screen.findByText("Accept"));

  await waitFor(() => expect(onSelectCommunity).toHaveBeenCalledWith(2));
  expect(screen.queryByText("Invited group")).toBeNull();
});

it("drops a declined invite from the list", async () => {
  myGroups = async () => Response.json([]);
  invitedTo = [group(2, "Invited group")];
  api.alsoServing({
    "POST /community/communityInvites/:inviteId/reject": () =>
      Response.json({}),
  });
  renderPage();
  fireEvent.click(await screen.findByText("Decline"));

  await waitFor(() => expect(screen.queryByText("Invited group")).toBeNull());
});

it.each([
  {
    button: "Accept",
    path: "accept",
    message: "Unable to accept that invite right now.",
  },
  {
    button: "Decline",
    path: "reject",
    message: "Unable to decline that invite right now.",
  },
])(
  "says when $button fails and keeps the invite",
  async ({ button, path, message }) => {
    myGroups = async () => Response.json([]);
    invitedTo = [group(2, "Invited group")];
    api.alsoServing({
      [`POST /community/communityInvites/:inviteId/${path}`]: failed,
    });
    const onSelectCommunity = jest.fn();
    renderPage({ onSelectCommunity });
    fireEvent.click(await screen.findByText(button));

    await screen.findByText(message);
    expect(screen.getByText("Invited group")).toBeTruthy();
    expect(onSelectCommunity).not.toHaveBeenCalled();
  },
);

it.each([
  { button: "Accept", path: "accept" },
  { button: "Decline", path: "reject" },
])("holds the invite while $button is in flight", async ({ button, path }) => {
  myGroups = async () => Response.json([]);
  invitedTo = [group(2, "Invited group")];
  const { promise, resolve } = Promise.withResolvers<Response>();
  let answers = 0;
  api.alsoServing({
    [`POST /community/communityInvites/:inviteId/${path}`]: () => {
      answers++;
      return promise;
    },
  });
  renderPage();
  fireEvent.click(await screen.findByText(button));
  await waitFor(() => expect(isDisabled("Accept")).toBe(true));
  expect(isDisabled("Decline")).toBe(true);
  fireEvent.click(screen.getByText(button));

  resolve(Response.json({}));
  await waitFor(() => expect(screen.queryByText("Invited group")).toBeNull());
  expect(answers).toBe(1);
  expect(screen.queryByText(/Unable to/)).toBeNull();
});

it("opens a group you lead or are a member of, offering Leave only on the latter", async () => {
  myGroups = async () =>
    Response.json([
      { ...group(1, "Led group"), leaders: [testUser] },
      group(2, "Member group"),
    ]);
  const onSelectCommunity = jest.fn();
  renderPage({ onSelectCommunity });
  fireEvent.click(await screen.findByText("Led group"));
  fireEvent.click(screen.getByText("Member group"));
  expect(onSelectCommunity.mock.calls).toEqual([[1], [2]]);
  expect(screen.getAllByText("Leave")).toHaveLength(1);
});

it("opens the create group form, closing it from its toggle or Cancel", async () => {
  myGroups = async () => Response.json([]);
  renderPage();
  fireEvent.click(await screen.findByText("Create group"));
  await screen.findByPlaceholderText("Enter group name");
  fireEvent.click(screen.getByText("Create group"));
  expect(screen.queryByPlaceholderText("Enter group name")).toBeNull();

  fireEvent.click(screen.getByText("Create group"));
  fireEvent.click(await screen.findByText("Cancel"));
  expect(screen.queryByPlaceholderText("Enter group name")).toBeNull();
});

it("opens a group you create and closes the form", async () => {
  myGroups = async () => Response.json([]);
  api.alsoServing({
    "POST /community/create": () => Response.json(group(5, "New group")),
  });
  const onSelectCommunity = jest.fn();
  renderPage({ onSelectCommunity });
  fireEvent.click(await screen.findByText("Create group"));
  fireEvent.click(await screen.findByText("Create"));
  await waitFor(() => expect(onSelectCommunity.mock.calls).toEqual([[5]]));
  expect(screen.queryByPlaceholderText("Enter group name")).toBeNull();
});

it("closes the leave dialog on a click outside it", async () => {
  myGroups = async () => Response.json([group(1, "My group")]);
  renderPage();
  fireEvent.click(await screen.findByText("Leave"));
  await screen.findByText(/Are you sure you want to leave/);
  // Retried: the dialog ignores outside clicks for 100ms after it opens.
  await waitFor(() => {
    fireEvent.click(document.body);
    expect(screen.queryByText(/Are you sure you want to leave/)).toBeNull();
  });
});

it.each([
  { answer: "Yes, reassign me", requests: 1 },
  { answer: "No", requests: 0 },
])(
  "asks before requesting reassignment out of your group, answering $answer",
  async ({ answer, requests }) => {
    myGroups = async () => Response.json([group(1, "My group")]);
    let joins = 0;
    api.alsoServing({
      "POST /user/groupAssignment/join": () => {
        joins++;
        return Response.json({});
      },
    });
    renderPage();
    fireEvent.click(await screen.findByText("Request reassignment"));
    fireEvent.click(await screen.findByText(answer));
    await waitFor(() =>
      expect(screen.queryByText("Yes, reassign me")).toBeNull(),
    );
    await waitFor(() => expect(joins).toBe(requests));
  },
);

it("asks before joining a public group, then opens it", async () => {
  myGroups = async () => Response.json([group(1, "My group")]);
  publicGroups = [group(2, "Public group")];
  api.alsoServing({
    "POST /community/:communityId/join": () =>
      Response.json(group(2, "Public group")),
  });
  const onSelectCommunity = jest.fn();
  renderPage({ onSelectCommunity });
  await screen.findByText("My group");
  await waitFor(() => expect(isDisabled("Join")).toBe(false));
  fireEvent.click(screen.getByText("Join"));
  fireEvent.click(await screen.findByText("Join group"));
  await screen.findByText("You joined Public group.");
  await waitFor(() => expect(onSelectCommunity.mock.calls).toEqual([[2]]));
});

it("joins no public group when you cancel its confirmation", async () => {
  myGroups = async () => Response.json([group(1, "My group")]);
  publicGroups = [group(2, "Public group")];
  let joins = 0;
  api.alsoServing({
    "POST /community/:communityId/join": () => {
      joins++;
      return Response.json(group(2, "Public group"));
    },
  });
  const onSelectCommunity = jest.fn();
  renderPage({ onSelectCommunity });
  await screen.findByText("My group");
  await waitFor(() => expect(isDisabled("Join")).toBe(false));
  fireEvent.click(screen.getByText("Join"));
  fireEvent.click(await screen.findByText("Cancel"));
  await waitFor(() => expect(screen.queryByText("Join group")).toBeNull());
  expect(joins).toBe(0);
  expect(onSelectCommunity).not.toHaveBeenCalled();
});

it.each([{ answer: offline }, { answer: failed }])(
  "says when joining a public group fails with $answer.name",
  async ({ answer }) => {
    myGroups = async () => Response.json([]);
    publicGroups = [group(2, "Public group")];
    api.alsoServing({ "POST /community/:communityId/join": answer });
    const onSelectCommunity = jest.fn();
    renderPage({ onSelectCommunity });
    await waitFor(() => expect(isDisabled("Join")).toBe(false));
    fireEvent.click(screen.getByText("Join"));
    await screen.findByText("Unable to join that group right now.");
    await waitFor(() => expect(isDisabled("Join")).toBe(false));
    expect(onSelectCommunity).not.toHaveBeenCalled();
  },
);
