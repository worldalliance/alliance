import { act, renderHook, waitFor } from "@testing-library/react";
import { queryKeys } from "./queryKeys";
import { makeConversation } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useCommunityConversation } from "./useCommunityConversation";

const unread = { ...makeConversation([]), hasUnread: true, unreadCount: 2 };
const read = { ...unread, hasUnread: false, unreadCount: 0 };

let requests: string[] = [];
let loadResponse: () => Response | Promise<Response>;

serveApi(
  routes({
    "GET /messaging/conversations/community/7": () => {
      requests.push("load");
      return loadResponse();
    },
    "POST /messaging/conversations/1/read": () => {
      requests.push("read");
      return Response.json(read);
    },
  }),
);

beforeEach(() => {
  requests = [];
  loadResponse = () => Response.json(unread);
});

const renderLoaded = async () => {
  const query = queryWrapper();
  const hook = renderHook(() => useCommunityConversation(7), {
    wrapper: query.wrapper,
  });
  await waitFor(() => expect(hook.result.current.conversation).toEqual(unread));
  return { hook, client: query.client };
};

it("loads the group's conversation", async () => {
  await renderLoaded();

  expect(requests).toEqual(["load"]);
});

it("stores the conversation that marking it read returns", async () => {
  const { hook, client } = await renderLoaded();

  act(() => hook.result.current.markRead(unread.id));

  await waitFor(() => expect(hook.result.current.conversation).toEqual(read));
  expect(client.getQueryData(queryKeys.communityConversation(7))).toEqual(read);
});

it("stores a live update over a reload already in flight", async () => {
  const { hook, client } = await renderLoaded();
  const { promise, resolve } = Promise.withResolvers<Response>();
  loadResponse = () => promise;
  const reload = client.refetchQueries({
    queryKey: queryKeys.communityConversation(7),
  });
  await waitFor(() => expect(requests).toEqual(["load", "load"]));

  const renamed = { ...unread, title: "Renamed" };
  await act(() => hook.result.current.storeConversation(renamed));
  resolve(Response.json(unread));
  await act(() => reload);

  expect(client.getQueryData(queryKeys.communityConversation(7))).toEqual(
    renamed,
  );
});

it("drops an update for a conversation the group's cache doesn't hold", async () => {
  const { hook, client } = await renderLoaded();

  await act(() =>
    hook.result.current.storeConversation({ ...unread, id: 2, title: "Other" }),
  );

  expect(client.getQueryData(queryKeys.communityConversation(7))).toEqual(
    unread,
  );
});
