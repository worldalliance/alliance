import { R } from "@alliance/common/result";
import type { CommunityDto, ConversationDto } from "@alliance/shared/client";
import { groupSettings } from "@alliance/shared/lib/copy";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  makeCommunity,
  makeConversation,
  makeProfile,
} from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../lib/AuthContext";
import { testAuthUser } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import CommunityPage from "./CommunityPage";
import * as messagesModule from "./messages";

let myGroups: () => Promise<Response>;
let groupChat: ConversationDto;

const api = serveApi(
  routes({
    "GET /community/list/my": () => myGroups(),
    "GET /community/list/public": () => Response.json([]),
    "GET /community/communityInvites": () => Response.json([]),
    "GET /community/memberContactInfo/:communityId": () =>
      Response.json([
        {
          id: 2,
          timeZone: null,
          phoneNumber: null,
          preferredReminderTimeLeaderTz: "9:00 AM",
          awayRanges: [],
        },
      ]),
    "GET /actions/communityMemberInfo/:communityId": () =>
      Response.json({ actions: [], suites: [], users: [] }),
    "GET /actions/communityCompletedActionsCount": () =>
      Response.json({ completedCount: 12 }),
    "GET /messaging/conversations/community/:communityId": () =>
      Response.json(groupChat),
    "POST /messaging/conversations/1/read": () => Response.json(groupChat),
  }),
);

beforeEach(() => {
  groupChat = makeConversation([]);
});

const isDisabled = (text: string) =>
  screen.getByText(text).closest("button")?.disabled;

const renderPage = (url = "/") => {
  const { client, wrapper: QueryWrapper } = queryWrapper();
  render(
    <QueryWrapper>
      <ToastProvider>
        <AuthContext.Provider
          value={authValue({
            user: { ...testAuthUser, undergoingGroupAssignment: false },
          })}
        >
          <MemoryRouter initialEntries={[url]}>
            <SiteAppProvider>
              <CommunityPage />
            </SiteAppProvider>
          </MemoryRouter>
        </AuthContext.Provider>
      </ToastProvider>
    </QueryWrapper>,
  );
  return client;
};

it("offers no group assignment until your groups load", async () => {
  const { promise, resolve } = Promise.withResolvers<Response>();
  myGroups = () => promise;
  renderPage();
  await screen.findByRole("status", { name: "Loading..." });
  expect(screen.queryByText("Request assignment")).toBeNull();

  resolve(Response.json([]));
  await screen.findByText("Request assignment");
});

it("keeps the retry on screen while retrying a failed load of your groups", async () => {
  myGroups = async () =>
    Response.json({ message: "Internal server error" }, { status: 500 });
  renderPage();
  await screen.findByText("Couldn't load your groups.");
  // MyGroupsPage mounting refetches the failed query; let that settle first.
  await waitFor(() => expect(isDisabled("Try again")).toBe(false));

  const { promise, resolve } = Promise.withResolvers<Response>();
  myGroups = () => promise;
  fireEvent.click(screen.getByText("Try again"));

  await waitFor(() => expect(isDisabled("Try again")).toBe(true));
  expect(screen.getByText("Couldn't load your groups.")).toBeTruthy();

  resolve(Response.json([]));
  await screen.findByText("Request assignment");
});

it("shows a leader each member's reminder time from their contact info", async () => {
  myGroups = async () =>
    Response.json([
      makeCommunity({
        leaders: [makeProfile(testAuthUser.id)],
        users: [makeProfile(testAuthUser.id), makeProfile(2)],
      }),
    ]);
  renderPage("/?tab=members&communityId=1");

  await screen.findByText("9:00 AM");
});

it("shows how many actions the community's members completed", async () => {
  myGroups = async () =>
    Response.json([makeCommunity({ users: [makeProfile(testAuthUser.id)] })]);
  renderPage("/?tab=members&communityId=1");

  const count = await screen.findByText("12");
  expect(count.parentElement?.textContent).toContain("actions completed");
});

describe("a leader editing their group", () => {
  const led = (overrides: Partial<CommunityDto> = {}) =>
    makeCommunity({
      leaders: [makeProfile(testAuthUser.id)],
      users: [makeProfile(testAuthUser.id)],
      ...overrides,
    });
  const nameInput = () =>
    screen.getByPlaceholderText<HTMLInputElement>("Enter group name");
  const descriptionInput = () =>
    screen.getByPlaceholderText<HTMLTextAreaElement>(
      "Enter group description...",
    );
  const checkbox = (setting: keyof typeof groupSettings) =>
    screen.getByLabelText<HTMLInputElement>(
      new RegExp(groupSettings[setting].name),
    );

  beforeEach(() => {
    myGroups = async () => Response.json([led()]);
  });

  it("saves the edited settings", async () => {
    let sent: unknown;
    api.alsoServing({
      "PATCH /community/:communityId": async ({ request }) => {
        sent = await request.json();
        return Response.json({ ...led(), name: "Renamed" });
      },
    });
    renderPage("/?tab=members&communityId=1");

    fireEvent.click(await screen.findByText("Edit"));
    fireEvent.change(nameInput(), { target: { value: "Renamed" } });
    fireEvent.change(descriptionInput(), { target: { value: "New rules" } });
    fireEvent.click(screen.getByText("Save"));

    await screen.findByRole("heading", { name: "Renamed" });
    expect(sent).toMatchObject({
      name: "Renamed",
      description: "New rules",
      maxCapacity: 10,
    });
  });

  it("discards the draft on cancel", async () => {
    renderPage("/?tab=members&communityId=1");

    fireEvent.click(await screen.findByText("Edit"));
    fireEvent.change(nameInput(), { target: { value: "Renamed" } });
    fireEvent.change(descriptionInput(), { target: { value: "New rules" } });
    fireEvent.click(screen.getByText("Cancel"));

    await screen.findByRole("heading", { name: "Ada's group" });
    fireEvent.click(screen.getByText("Edit"));
    expect(nameInput().value).toBe("Ada's group");
    expect(descriptionInput().value).toBe("A group");
  });

  it("starts the capacity at no less than the member count", async () => {
    myGroups = async () =>
      Response.json([
        led({
          maxCapacity: 1,
          users: [makeProfile(testAuthUser.id), makeProfile(2), makeProfile(3)],
        }),
      ]);
    renderPage("/?tab=members&communityId=1");

    fireEvent.click(await screen.findByText("Edit"));
    expect(screen.getByRole<HTMLInputElement>("spinbutton").value).toBe("2");
  });

  it("saves each access setting on its own, with no capacity once none needs one", async () => {
    let sent: unknown;
    api.alsoServing({
      "PATCH /community/:communityId": async ({ request }) => {
        sent = await request.json();
        return Response.json(led());
      },
    });
    renderPage("/?tab=members&communityId=1");

    fireEvent.click(await screen.findByText("Edit"));
    fireEvent.click(checkbox("allowMemberInvites"));
    expect(checkbox("allowMemberInvites").checked).toBe(false);
    expect(checkbox("allowStaffAssignments").checked).toBe(true);
    fireEvent.click(checkbox("allowStaffAssignments"));
    expect(checkbox("allowStaffAssignments").checked).toBe(false);
    expect(screen.queryByRole("spinbutton")).toBeNull();
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(sent).toMatchObject({
        public: false,
        allowMemberInvites: false,
        allowStaffAssignments: false,
        maxCapacity: null,
      }),
    );
  });

  it("makes a public group allow invites and staff assignments", async () => {
    myGroups = async () =>
      Response.json([
        led({
          allowMemberInvites: false,
          allowStaffAssignments: false,
          maxCapacity: null,
        }),
      ]);
    let sent: unknown;
    api.alsoServing({
      "PATCH /community/:communityId": async ({ request }) => {
        sent = await request.json();
        return Response.json(led({ public: true }));
      },
    });
    renderPage("/?tab=members&communityId=1");

    fireEvent.click(await screen.findByText("Edit"));
    expect(screen.queryByRole("spinbutton")).toBeNull();
    fireEvent.click(checkbox("public"));
    for (const setting of [
      "allowMemberInvites",
      "allowStaffAssignments",
    ] as const) {
      expect(checkbox(setting).checked).toBe(true);
      expect(checkbox(setting).disabled).toBe(true);
    }
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(sent).toMatchObject({
        public: true,
        allowMemberInvites: true,
        allowStaffAssignments: true,
        maxCapacity: 5,
      }),
    );
  });

  it("refuses to save a group open to new members without a capacity", async () => {
    renderPage("/?tab=members&communityId=1");

    fireEvent.click(await screen.findByText("Edit"));
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("Save"));

    await screen.findByText(/^Capacity is required/);
  });

  it("stays in edit mode with the server's message when a save fails", async () => {
    api.alsoServing({
      "PATCH /community/:communityId": () =>
        Response.json({ message: "Name is taken" }, { status: 400 }),
    });
    renderPage("/?tab=members&communityId=1");

    fireEvent.click(await screen.findByText("Edit"));
    fireEvent.click(screen.getByText("Save"));

    await screen.findByText("Name is taken");
    expect(nameInput()).toBeTruthy();
  });

  it("keeps the group with the server's message when a delete fails", async () => {
    api.alsoServing({
      "DELETE /community/:communityId": () =>
        Response.json({ message: "Group has members" }, { status: 400 }),
    });
    renderPage("/?tab=members&communityId=1");

    fireEvent.click(await screen.findByText("Edit"));
    fireEvent.click(screen.getByText("Delete"));

    await screen.findByText("Group has members");
    expect(nameInput().value).toBe("Ada's group");
  });

  it("returns to group management after deleting the group", async () => {
    api.alsoServing({
      "DELETE /community/:communityId": () => {
        myGroups = async () => Response.json([]);
        return Response.json({});
      },
    });
    renderPage("/?tab=members&communityId=1");

    fireEvent.click(await screen.findByText("Edit"));
    fireEvent.click(screen.getByText("Delete"));

    await screen.findByRole("heading", { name: "Manage groups" });
  });
});

describe("the group chat on a large screen", () => {
  const message = (id: string) => ({
    id,
    body: "Hello",
    attachments: [],
    createdAt: "2026-09-17T00:00:00.000Z",
    deletedAt: null,
    author: makeProfile(2),
    conversationId: 1,
  });
  const openChatButton = () => screen.queryByTitle("Open Chat");

  beforeEach(() => {
    jest.spyOn(window, "matchMedia").mockReturnValue(
      Object.assign(new EventTarget(), {
        matches: true,
        media: "",
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
      }),
    );
    jest.spyOn(messagesModule, "default").mockReturnValue({
      messages: [],
      sendMessage: async () => R.failure({ title: "", message: "" }),
    });
    myGroups = async () =>
      Response.json([makeCommunity({ users: [makeProfile(testAuthUser.id)] })]);
  });

  it("starts closed for a group with no messages", async () => {
    renderPage("/?tab=members&communityId=1");

    await screen.findByTitle("Close Chat");
    expect(openChatButton()).toBeTruthy();
  });

  it("opens for a group with messages, and stays closed once closed", async () => {
    groupChat = { ...makeConversation([]), lastMessage: message("a") };
    const client = renderPage("/?tab=members&communityId=1");

    const close = await screen.findByTitle("Close Chat");
    await waitFor(() => expect(openChatButton()).toBeFalsy());
    fireEvent.click(close);
    expect(openChatButton()).toBeTruthy();

    groupChat = { ...groupChat, title: "Renamed", lastMessage: message("b") };
    await client.refetchQueries({
      queryKey: queryKeys.communityConversation(1),
    });

    await screen.findByText("Renamed");
    expect(openChatButton()).toBeTruthy();
  });
});
