import { pending, type Pending } from "@alliance/shared/lib/testing/pending";
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
let friendsFail = false;
const failed = () =>
  Response.json({ message: "Internal server error" }, { status: 500 });

const api = serveApi(
  routes({
    "GET /user/listfriends/:id": () =>
      friendsFail ? failed() : Response.json([]),
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
  friendsFail = false;
  cleanup();
});

const renderFriendsTab = (query = queryWrapper()) => {
  const { client, wrapper: QueryWrapper } = query;
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

it("offers a retry when the friends list fails to load", async () => {
  friendsFail = true;
  received = [];
  renderFriendsTab();
  await screen.findByText("Couldn't load this list.");
  screen.getByText("Friends");

  const retries: Pending<Response>[] = [];
  api.alsoServing({
    "GET /user/listfriends/:id": () => pending(retries),
  });
  fireEvent.click(screen.getByText("Try again"));
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(screen.getByText("Try again").closest("button")?.disabled).toBe(true);
  screen.getByText("Friends");
  expect(screen.queryByText("No friends yet.")).toBeNull();

  retries[0]?.resolve(Response.json([]));
  await screen.findByText("No friends yet.");
  screen.getByText("Friends (0)");
});

it("offers a retry when received requests fail to load", async () => {
  api.alsoServing({ "GET /user/friends/requests/received": failed });
  renderFriendsTab();
  fireEvent.click(await screen.findByText("Received Requests"));
  await screen.findByText("Couldn't load this list.");

  api.alsoServing({});
  fireEvent.click(screen.getByText("Try again"));

  await screen.findByText("Received Requests (1)");
  screen.getByText("Grace");
});

it("offers a retry when sent requests fail to load", async () => {
  api.alsoServing({ "GET /user/friends/requests/sent": failed });
  renderFriendsTab();
  fireEvent.click(await screen.findByText("Sent Requests"));
  await screen.findByText("Couldn't load this list.");

  api.alsoServing({});
  sent = [LINUS];
  fireEvent.click(screen.getByText("Try again"));

  await screen.findByText("Sent Requests (1)");
  screen.getByText("Linus");
});

it("disables Try again while a list that failed before reloads", async () => {
  friendsFail = true;
  received = [];
  const query = queryWrapper();
  renderFriendsTab(query);
  await screen.findByText("Couldn't load this list.");
  cleanup();

  const reloads: Pending<Response>[] = [];
  api.alsoServing({
    "GET /user/listfriends/:id": () => pending(reloads),
  });
  renderFriendsTab(query);
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(reloads).toHaveLength(1);
  expect(screen.getByText("Try again").closest("button")?.disabled).toBe(true);

  reloads[0]?.resolve(Response.json([]));
  await screen.findByText("No friends yet.");
});
