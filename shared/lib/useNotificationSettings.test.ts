import { act, renderHook, waitFor } from "@testing-library/react";
import { makeKindSettings, makeNotificationSettings } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { SaveStatus, useNotificationSettings } from "./useNotificationSettings";

const stored = makeNotificationSettings({
  kinds: [
    makeKindSettings({
      cells: [
        { channel: "push", override: null, enabled: true, editable: true },
      ],
    }),
  ],
});

let current = stored;
let get: () => Response | Promise<Response>;
let patch: (body: unknown) => Response | Promise<Response>;
const bodies: unknown[] = [];

serveApi(
  routes({
    "GET /user/notification-settings": () => get(),
    "PATCH /user/notification-settings": async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      return patch(body);
    },
  }),
);

beforeEach(() => {
  current = stored;
  get = () => Response.json(current);
  bodies.length = 0;
});

const pushDefault = { type: "default", channel: "push" } as const;
const likesPush = { type: "cell", kind: "likes", channel: "push" } as const;

const render = async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useNotificationSettings(), { wrapper });
  await waitFor(() => expect(hook.result.current.settings).toBeDefined());
  return hook;
};

it("shows a choice while it saves, then the server's settings", async () => {
  let respond: (response: Response) => void = () => {};
  patch = () => new Promise((resolve) => (respond = resolve));
  const { result } = await render();

  act(() => result.current.save([{ ...pushDefault, value: false }]));

  await waitFor(() =>
    expect(result.current.statusOf(pushDefault)).toBe(SaveStatus.Saving),
  );
  expect(result.current.settings?.defaults.push).toBe(false);
  expect(result.current.settings?.kinds[0].cells[0].enabled).toBe(false);

  current = { ...stored, defaults: { ...stored.defaults, push: false } };
  await waitFor(() => expect(bodies).toHaveLength(1));
  respond(Response.json(current));

  await waitFor(() =>
    expect(result.current.statusOf(pushDefault)).toBe(SaveStatus.Saved),
  );
  expect(result.current.settings?.defaults.push).toBe(false);
  expect(bodies).toEqual([{ defaults: { push: false } }]);
});

it("keeps a failed choice on its control, out of the settings, and retries it", async () => {
  patch = () => Response.json({ message: "nope" }, { status: 500 });
  const { result } = await render();

  act(() => result.current.save([{ ...likesPush, value: false }]));

  await waitFor(() =>
    expect(result.current.statusOf(likesPush)).toBe(SaveStatus.Failed),
  );
  const [likes] = result.current.settings?.kinds ?? [];
  expect(result.current.shownOverride("likes", likes.cells[0])).toBe(false);
  expect(result.current.resetOf(likes)).toEqual([
    { ...likesPush, value: null },
  ]);
  expect(result.current.settings?.kinds[0].cells[0]).toMatchObject({
    override: null,
    enabled: true,
  });

  current = {
    ...stored,
    kinds: [
      {
        ...stored.kinds[0],
        cells: [
          { ...stored.kinds[0].cells[0], override: false, enabled: false },
        ],
      },
    ],
  };
  patch = () => Response.json(current);
  act(() => result.current.retry(likesPush));

  await waitFor(() =>
    expect(result.current.statusOf(likesPush)).toBe(SaveStatus.Saved),
  );
  expect(bodies).toEqual([
    { cells: [{ kind: "likes", channel: "push", override: false }] },
    { cells: [{ kind: "likes", channel: "push", override: false }] },
  ]);
});

it("sends saves one at a time, in order", async () => {
  const pending: ((response: Response) => void)[] = [];
  patch = () => new Promise((resolve) => pending.push(resolve));
  const { result } = await render();

  act(() => {
    result.current.save([{ ...pushDefault, value: false }]);
    result.current.save([{ ...likesPush, value: true }]);
  });

  await waitFor(() => expect(pending).toHaveLength(1));
  pending[0](Response.json(stored));
  await waitFor(() => expect(pending).toHaveLength(2));
  expect(bodies).toEqual([
    { defaults: { push: false } },
    { cells: [{ kind: "likes", channel: "push", override: true }] },
  ]);
  pending[1](Response.json(stored));
  await waitFor(() =>
    expect(result.current.statusOf(likesPush)).toBe(SaveStatus.Saved),
  );
});

it("keeps the newer choice when an older save of the same control lands", async () => {
  const pending: ((response: Response) => void)[] = [];
  patch = () => new Promise((resolve) => pending.push(resolve));
  const { result } = await render();

  act(() => {
    result.current.save([{ ...pushDefault, value: false }]);
    result.current.save([{ ...pushDefault, value: true }]);
  });

  await waitFor(() => expect(pending).toHaveLength(1));
  pending[0](
    Response.json({ ...stored, defaults: { ...stored.defaults, push: false } }),
  );
  await waitFor(() => expect(pending).toHaveLength(2));
  expect(result.current.statusOf(pushDefault)).toBe(SaveStatus.Saving);
  expect(result.current.settings?.defaults.push).toBe(true);
});

it("keeps a save over a fetch already in flight when it lands", async () => {
  const { result } = await render();
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  get = async () => {
    const read = current;
    await held;
    return Response.json(read);
  };
  patch = () => {
    current = { ...stored, defaults: { ...stored.defaults, push: false } };
    return Response.json(current);
  };

  act(() => void result.current.refetch());
  act(() => result.current.save([{ ...pushDefault, value: false }]));
  await waitFor(() =>
    expect(result.current.statusOf(pushDefault)).toBe(SaveStatus.Saved),
  );
  await act(async () => {
    release();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  expect(result.current.settings?.defaults.push).toBe(false);
});

it("orders saves from different screens", async () => {
  const pending: ((response: Response) => void)[] = [];
  patch = () => new Promise((resolve) => pending.push(resolve));
  const { wrapper } = queryWrapper();
  const first = renderHook(() => useNotificationSettings(), { wrapper });
  const second = renderHook(() => useNotificationSettings(), { wrapper });
  await waitFor(() => expect(second.result.current.settings).toBeDefined());

  act(() => first.result.current.save([{ ...pushDefault, value: false }]));
  act(() => second.result.current.save([{ ...likesPush, value: true }]));

  await waitFor(() => expect(pending).toHaveLength(1));
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(pending).toHaveLength(1);
});

it("shows a failed save on a screen opened after the one that made it", async () => {
  patch = () => Response.json({ message: "nope" }, { status: 500 });
  const { wrapper } = queryWrapper();
  const first = renderHook(() => useNotificationSettings(), { wrapper });
  await waitFor(() => expect(first.result.current.settings).toBeDefined());

  act(() => first.result.current.save([{ ...likesPush, value: false }]));
  first.unmount();
  const second = renderHook(() => useNotificationSettings(), { wrapper });

  await waitFor(() =>
    expect(second.result.current.statusOf(likesPush)).toBe(SaveStatus.Failed),
  );
  const [likes] = second.result.current.settings?.kinds ?? [];
  expect(second.result.current.shownOverride("likes", likes.cells[0])).toBe(
    false,
  );
});
