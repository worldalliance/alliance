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

const conversationsHook = (conversations: ConversationDto[]) => ({
  conversations,
  setConversations: () => {},
  loading: false,
  reloadFailed: false,
  refreshConversations: async () => {},
});

let listed: ConversationDto[] = [];
let listFails = false;
let messageableUsersCalls = 0;
let heldRetry: Promise<Response> | null = null;

serveApi(
  routes({
    "GET /user/listMessageableUsers": () =>
      ++messageableUsersCalls === 1
        ? Response.json({ message: "Internal server error" }, { status: 500 })
        : (heldRetry ?? Response.json([GRACE])),
    "GET /messaging/conversations": () =>
      listFails
        ? Response.json({ message: "Internal server error" }, { status: 500 })
        : Response.json(listed),
    "POST /messaging/conversations/:conversationId/read": () =>
      new Response(null, { status: 201 }),
  }),
);

beforeEach(() => {
  listed = [];
  listFails = false;
  messageableUsersCalls = 0;
  heldRetry = null;
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
  jest
    .spyOn(messagesModule, "useConversations")
    .mockReturnValue(conversationsHook([group]));
  renderPage({}, `/?chat=${group.id}`);
  fireEvent.click(screen.getByText(group.title, { selector: "p" }));

  await screen.findByText("Couldn't load the people you can add.");
  expect(screen.queryByPlaceholderText("Add member...")).toBeNull();

  fireEvent.click(screen.getByText("Try again"));

  await screen.findByPlaceholderText("Add member...");
  expect(
    screen.queryByText("Couldn't load the people you can add."),
  ).toBeNull();
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
    .mockImplementation(useMyConversations);
  renderPage({}, `/?to=${GRACE.id}`, []);

  await screen.findAllByText("Chat with Grace");

  await waitFor(() => expect(screen.queryByText("New message")).toBeNull());
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
    .mockImplementation(useMyConversations);
  renderPage({}, `/?chat=${group.id}`, []);

  expect(screen.queryByText("No chat selected")).toBeNull();
  await screen.findByText("Linked group", { selector: "p" });
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
