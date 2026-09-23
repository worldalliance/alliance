import type { ProfileDto } from "@alliance/shared/client";
import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
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

let messageableUsersCalls = 0;
let heldRetry: Promise<Response> | null = null;

serveApi(
  routes({
    "GET /user/listMessageableUsers": () =>
      ++messageableUsersCalls === 1
        ? Response.json({ message: "Internal server error" }, { status: 500 })
        : (heldRetry ?? Response.json([GRACE])),
  }),
);

beforeEach(() => {
  messageableUsersCalls = 0;
  heldRetry = null;
  jest.spyOn(messagesModule, "useConversations").mockReturnValue({
    conversations: [],
    setConversations: () => {},
    loading: false,
    refreshConversations: async () => {},
  });
  jest.spyOn(messagesModule, "default").mockReturnValue({
    messages: null,
    addOptimisticMessage: () => {},
    removeOptimisticMessage: () => {},
  });
});

afterEach(cleanup);

const renderPage = (queries: Parameters<typeof queryWrapper>[0]) => {
  const { wrapper: QueryWrapper } = queryWrapper(queries);
  render(
    <QueryWrapper>
      <AuthContext.Provider value={authValue({ user: testAuthUser })}>
        <MemoryRouter>
          <MessagesPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryWrapper>,
  );
  fireEvent.click(screen.getByRole("button", { name: "New chat" }));
};

const searchRecipients = async (value: string) =>
  fireEvent.change(await screen.findByPlaceholderText("Search by name"), {
    target: { value },
  });

it("offers messageable users once a failed load succeeds on retry", async () => {
  renderPage({ retry: retryUnlessRefused(3), retryDelay: 0 });
  await searchRecipients("Gra");

  await screen.findByText("Grace");
});

it("offers a retry in place of the picker when messageable users fail to load", async () => {
  renderPage({});

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
