import type { ProfileDto } from "@alliance/shared/client";
import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

serveApi(
  routes({
    "GET /user/listMessageableUsers": () =>
      ++messageableUsersCalls === 1
        ? Response.json({ message: "Internal server error" }, { status: 500 })
        : Response.json([GRACE]),
  }),
);

beforeEach(() => {
  messageableUsersCalls = 0;
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

it("offers messageable users once a failed load succeeds on retry", async () => {
  const { wrapper: QueryWrapper } = queryWrapper({
    retry: retryUnlessRefused(3),
    retryDelay: 0,
  });
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
  fireEvent.change(screen.getByPlaceholderText("Search by name"), {
    target: { value: "Gra" },
  });

  await screen.findByText("Grace");
});
