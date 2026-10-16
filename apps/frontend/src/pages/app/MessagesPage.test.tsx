import type { ConversationDto, ProfileDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import {
  makeConversation,
  makeParticipant,
} from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { useMyConversations } from "@alliance/shared/lib/useMyConversations";
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
import * as messagesModule from "./messages";
import MessagesPage from "./MessagesPage";

const GRACE: ProfileDto = {
  id: 2,
  admin: false,
  staff: false,
  ambassador: false,
  profilePicture: null,
  profileDescription: null,
  anonymous: false,
  displayName: "Grace",
  hasActiveContract: true,
  isCommunityLeader: false,
};

const ALAN: ProfileDto = { ...GRACE, id: 3, displayName: "Alan" };

const conversationsHook = (conversations: ConversationDto[]) => ({
  conversations,
  setConversations: () => {},
  loading: false,
  reloadFailed: false,
  refreshConversations: async () => {},
  createDirectConversation: jest.fn(),
  createGroupConversation: jest.fn(),
  acceptInvite: jest.fn(),
  declineInvite: jest.fn(),
  markRead: jest.fn(),
  updateInfo: jest.fn(),
  addParticipant: jest.fn(),
  removeParticipant: jest.fn(),
  leave: jest.fn(),
});

let listed: ConversationDto[] = [];
let listFails = false;
let messageableUsersCalls = 0;
let heldRetry: Promise<Response> | null = null;
let markedRead: string[] = [];
let answered: ConversationDto | null = null;
let groupsStarted: unknown[] = [];

serveApi(
  routes({
    "GET /user/listMessageableUsers": () =>
      ++messageableUsersCalls === 1
        ? Response.json({ message: "Internal server error" }, { status: 500 })
        : (heldRetry ?? Response.json([GRACE, ALAN])),
    "GET /messaging/conversations": () =>
      listFails
        ? Response.json({ message: "Internal server error" }, { status: 500 })
        : Response.json(listed),
    "POST /messaging/conversations/direct": () => Response.json(answered),
    "POST /messaging/conversations/group": async ({ request }) => {
      groupsStarted.push(await request.json());
      return Response.json(answered);
    },
    "POST /messaging/messages": () => Response.json({}),
    "POST /messaging/conversations/:conversationId/accept": () =>
      Response.json(answered),
    "POST /messaging/conversations/:conversationId/decline": () =>
      Response.json(answered),
    "POST /messaging/conversations/:conversationId/read": ({ params }) => {
      markedRead.push(params.conversationId);
      return new Response(null, { status: 201 });
    },
  }),
);

beforeEach(() => {
  listed = [];
  listFails = false;
  messageableUsersCalls = 0;
  heldRetry = null;
  markedRead = [];
  answered = null;
  groupsStarted = [];
  jest
    .spyOn(messagesModule, "useConversations")
    .mockReturnValue(conversationsHook([]));
  jest.spyOn(messagesModule, "default").mockReturnValue({
    messages: null,
    addOptimisticMessage: () => {},
    removeOptimisticMessage: () => {},
  });
});

afterEach(cleanup);

const renderPage = (
  queries: Parameters<typeof queryWrapper>[0],
  path: string = "/",
  cachedConversations?: ConversationDto[],
) => {
  const { wrapper: QueryWrapper, client } = queryWrapper(queries);
  if (cachedConversations) {
    client.setQueryData(queryKeys.myConversations(), cachedConversations);
  }
  render(
    <QueryWrapper>
      <AuthContext.Provider value={authValue({ user: testAuthUser })}>
        <MemoryRouter initialEntries={[path]}>
          <MessagesPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryWrapper>,
  );
};

const openNewChat = () =>
  fireEvent.click(screen.getByRole("button", { name: "New chat" }));

const searchRecipients = async (value: string) =>
  fireEvent.change(await screen.findByPlaceholderText("Search by name"), {
    target: { value },
  });

it("offers messageable users once a failed load succeeds on retry", async () => {
  renderPage({ retry: retryUnlessRefused(3), retryDelay: 0 });
  openNewChat();
  await searchRecipients("Gra");

  await screen.findByText("Grace");
});

it("offers a retry in place of the picker when messageable users fail to load", async () => {
  renderPage({});
  openNewChat();

  await screen.findByText("Couldn't load the people you can message.");
  expect(screen.queryByPlaceholderText("Search by name")).toBeNull();

  const { promise, resolve } = Promise.withResolvers<Response>();
  heldRetry = promise;
  fireEvent.click(screen.getByText("Try again"));

  await waitFor(() =>
    expect(screen.getByText("Try again").closest("button")?.disabled).toBe(
      true,
    ),
  );
  screen.getByText("Couldn't load the people you can message.");
  expect(screen.queryByPlaceholderText("Search by name")).toBeNull();

  resolve(Response.json([GRACE]));
  await searchRecipients("Gra");

  await screen.findByText("Grace");
  expect(
    screen.queryByText("Couldn't load the people you can message."),
  ).toBeNull();
});

it("offers a retry in place of the add-member field when messageable users fail to load", async () => {
  const group = makeConversation([
    makeParticipant(testAuthUser.id, "admin"),
    makeParticipant(GRACE.id + 1, "member"),
  ]);
  const hook = conversationsHook([group]);
  jest.spyOn(messagesModule, "useConversations").mockReturnValue(hook);
  renderPage({}, `/?chat=${group.id}`);
  fireEvent.click(screen.getByText(group.title, { selector: "p" }));

  await screen.findByText("Couldn't load the people you can add.");
  expect(screen.queryByPlaceholderText("Add member...")).toBeNull();

  fireEvent.click(screen.getByText("Try again"));

  await screen.findByPlaceholderText("Add member...");
  expect(
    screen.queryByText("Couldn't load the people you can add."),
  ).toBeNull();
  expect(hook.markRead).toHaveBeenCalledWith(group.id);
});

it("opens the direct chat a profile links to once a cached list that predates it reloads", async () => {
  const chat = {
    ...makeConversation(
      [
        makeParticipant(testAuthUser.id, "member"),
        makeParticipant(GRACE.id, "member"),
      ],
      "direct",
    ),
    title: "Chat with Grace",
  };
  listed = [chat];
  jest
    .spyOn(messagesModule, "useConversations")
    .mockImplementation(() => useMyConversations());
  renderPage({}, `/?to=${GRACE.id}`, []);

  await screen.findAllByText("Chat with Grace");

  await waitFor(() => expect(screen.queryByText("New message")).toBeNull());
  await waitFor(() => expect(markedRead).toEqual([String(chat.id)]));
});

it("waits for a cached list that predates a linked chat to reload, rather than saying no chat is selected", async () => {
  const group = {
    ...makeConversation([
      makeParticipant(testAuthUser.id, "admin"),
      makeParticipant(GRACE.id, "member"),
    ]),
    id: 12,
    title: "Linked group",
  };
  listed = [group];
  jest
    .spyOn(messagesModule, "useConversations")
    .mockImplementation(() => useMyConversations());
  renderPage({}, `/?chat=${group.id}`, []);

  expect(screen.queryByText("No chat selected")).toBeNull();
  await screen.findByText("Linked group", { selector: "p" });
  await waitFor(() => expect(markedRead).toEqual([String(group.id)]));
});

it("keeps the cached chats and offers a retry when reloading them fails", async () => {
  const group = {
    ...makeConversation([makeParticipant(testAuthUser.id, "admin")]),
    title: "Cached group",
  };
  listFails = true;
  jest
    .spyOn(messagesModule, "useConversations")
    .mockImplementation(() => useMyConversations());
  renderPage({}, "/", [group]);

  await screen.findByText("Couldn't refresh your chats.");
  screen.getByText("Cached group");

  listFails = false;
  listed = [group];
  fireEvent.click(screen.getByText("Try again"));

  await waitFor(() =>
    expect(screen.queryByText("Couldn't refresh your chats.")).toBeNull(),
  );
});

const invitation = () => {
  const joined = {
    ...makeConversation([
      makeParticipant(testAuthUser.id, "member"),
      makeParticipant(GRACE.id, "admin"),
    ]),
    title: "Invited group",
  };
  const invited = {
    ...joined,
    participants: [
      { ...joined.participants[0], state: "invited" as const },
      joined.participants[1],
    ],
  };
  listed = [invited];
  jest
    .spyOn(messagesModule, "useConversations")
    .mockImplementation(() => useMyConversations());
  renderPage({}, `/?chat=${invited.id}`);
  return joined;
};

it("lists an accepted group among the chats", async () => {
  answered = invitation();

  fireEvent.click(await screen.findByRole("button", { name: "Accept" }));

  await waitFor(() =>
    expect(
      screen.queryByText("You have been invited to the group chat"),
    ).toBeNull(),
  );
  screen.getByText("Invited group", { selector: "p" });
});

it("drops a declined group and closes it", async () => {
  const joined = invitation();
  answered = { ...joined, participants: joined.participants.slice(1) };

  fireEvent.click(await screen.findByRole("button", { name: "Decline" }));

  await screen.findByText("No chat selected");
  expect(screen.queryByText("Invited group")).toBeNull();
});

it("lists and opens a chat the viewer starts", async () => {
  answered = {
    ...makeConversation(
      [
        makeParticipant(testAuthUser.id, "member"),
        makeParticipant(GRACE.id, "member"),
      ],
      "direct",
    ),
    title: "Chat with Grace",
  };
  jest
    .spyOn(messagesModule, "useConversations")
    .mockImplementation(() => useMyConversations());
  renderPage({ retry: retryUnlessRefused(3), retryDelay: 0 });
  fireEvent.click(await screen.findByRole("button", { name: "New chat" }));
  await searchRecipients("Gra");
  fireEvent.click(await screen.findByText("Grace"));
  const draft = screen.getByPlaceholderText("Message");
  fireEvent.change(draft, { target: { value: "Hi" } });

  fireEvent.keyDown(draft, { key: "Enter" });

  await screen.findByText("Chat with Grace", { selector: "p" });
  await waitFor(() => expect(markedRead).toEqual([String(answered?.id)]));
});

it("names a group the viewer starts after everyone in it, and opens it", async () => {
  answered = {
    ...makeConversation([
      makeParticipant(testAuthUser.id, "admin"),
      makeParticipant(GRACE.id, "member"),
      makeParticipant(ALAN.id, "member"),
    ]),
    title: "Grace, Alan, First Lastname",
  };
  jest
    .spyOn(messagesModule, "useConversations")
    .mockImplementation(() => useMyConversations());
  renderPage({ retry: retryUnlessRefused(3), retryDelay: 0 });
  fireEvent.click(await screen.findByRole("button", { name: "New chat" }));
  await searchRecipients("Gra");
  fireEvent.click(await screen.findByText("Grace"));
  await searchRecipients("Ala");
  fireEvent.click(await screen.findByText("Alan"));
  const draft = screen.getByPlaceholderText("Message");
  fireEvent.change(draft, { target: { value: "Hi" } });

  fireEvent.keyDown(draft, { key: "Enter" });

  await screen.findByText("Grace, Alan, First Lastname", { selector: "p" });
  expect(groupsStarted).toEqual([
    {
      participantIds: [GRACE.id, ALAN.id],
      title: "Grace, Alan, First Lastname",
    },
  ]);
});
