import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  useSendFriendRequestMutation,
  userQueryKeys,
} from "@alliance/shared/lib/user";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import FriendsTab from "./FriendsTab";

const GRACE = { id: 2, displayName: "Grace" };
const LINUS = { id: 3, displayName: "Linus" };

let received = [GRACE];
let sent: (typeof LINUS)[] = [];

serveApi(
  routes({
    "GET /user/listfriends/:id": () => Response.json([]),
    "GET /user/friends/requests/received": () => Response.json(received),
    "GET /user/friends/requests/sent": () => Response.json(sent),
    "POST /user/friends/:targetUserId": () => {
      sent = [LINUS];
      return new Response(null, { status: 201 });
    },
    "PATCH /user/friends/:requesterId/accept": () => {
      received = [];
      return new Response(null, { status: 201 });
    },
    "PATCH /user/friends/:requesterId/decline": () =>
      Response.json({ message: "No pending request found" }, { status: 404 }),
  }),
);

afterEach(() => {
  received = [GRACE];
  sent = [];
  cleanup();
});

const renderFriendsTab = () => {
  const { client, wrapper: QueryWrapper } = queryWrapper();
  render(
    <QueryWrapper>
      <ToastProvider>
        <MemoryRouter>
          <FriendsTab userId={7} isMe />
        </MemoryRouter>
      </ToastProvider>
    </QueryWrapper>,
  );
  return { client, wrapper: QueryWrapper };
};

it("counts a request sent from a profile page", async () => {
  const { wrapper } = renderFriendsTab();
  await screen.findByText("Sent Requests (0)");

  const sendRequest = renderHook(() => useSendFriendRequestMutation(), {
    wrapper,
  });
  await act(() => sendRequest.result.current.mutateAsync(LINUS.id));

  await screen.findByText("Sent Requests (1)");
});

it("marks an accepted requester as a friend on their profile", async () => {
  const { client } = renderFriendsTab();
  fireEvent.click(await screen.findByText("Received Requests (1)"));
  fireEvent.click(await screen.findByText("Accept"));

  await screen.findByText("Received Requests (0)");
  expect(
    client.getQueryData(userQueryKeys.friendStatus(GRACE.id)),
  ).toMatchObject({ status: "accepted" });
});

it("tells the user when the server refuses a decline", async () => {
  renderFriendsTab();
  fireEvent.click(await screen.findByText("Received Requests (1)"));
  fireEvent.click(await screen.findByText("Decline"));

  await screen.findByText("Couldn't decline friend request");
  screen.getByText("No pending request found");
});
