import { renderHook, waitFor } from "@testing-library/react";
import { queryKeys } from "./queryKeys";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useUpdateInviteMessageTemplate } from "./useInviteMessageTemplate";

let status = 200;

serveApi(
  routes({
    "PATCH /share-urls/invite-message-template": async ({ request }) => {
      if (status !== 200) {
        return Response.json({ message: "down" }, { status });
      }
      const body: { template: string } = await request.json();
      return Response.json({ template: body.template });
    },
  }),
);

beforeEach(() => {
  status = 200;
});

const renderUpdate = () => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.inviteMessageTemplate(), "Old {link}");
  const callbacks = { onSuccess: jest.fn(), onError: jest.fn() };
  const hook = renderHook(
    () => useUpdateInviteMessageTemplate(callbacks),
    query,
  );
  const cached = () =>
    query.client.getQueryData(queryKeys.inviteMessageTemplate());
  return { hook, callbacks, cached };
};

it("writes the saved template into the cache", async () => {
  const { hook, callbacks, cached } = renderUpdate();

  hook.result.current.mutate("New {link}");

  await waitFor(() => expect(callbacks.onSuccess).toHaveBeenCalled());
  expect(cached()).toBe("New {link}");
  expect(callbacks.onError).not.toHaveBeenCalled();
});

it("leaves the cache alone when the save fails", async () => {
  status = 500;
  const { hook, callbacks, cached } = renderUpdate();

  hook.result.current.mutate("New {link}");

  await waitFor(() => expect(callbacks.onError).toHaveBeenCalled());
  expect(cached()).toBe("Old {link}");
  expect(callbacks.onSuccess).not.toHaveBeenCalled();
});
