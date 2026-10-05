import type { AdminWaitlistTagDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useChangeWaitlistEntryTagsAdmin,
  useDeleteWaitlistTagAdmin,
  useRenameWaitlistTagAdmin,
  useWaitlistTagsAdmin,
} from "./useWaitlistTagsAdmin";

afterEach(cleanup);

const tag = {
  id: 5,
  name: "Press",
  entryCount: 2,
} satisfies AdminWaitlistTagDto;

let stored: AdminWaitlistTagDto[] = [tag];
let writeStatus = 200;
const calls: string[] = [];

const refuse = () => {
  stored = [{ ...tag, name: "Changed elsewhere" }];
  return Response.json({}, { status: writeStatus });
};

const changeEntries =
  (path: string) =>
  async ({
    request,
    params,
  }: {
    request: Request;
    params: { id?: string };
  }) => {
    calls.push(`${path} ${params.id}`);
    if (writeStatus !== 200) return refuse();
    const body: { entryIds: number[] } = await request.json();
    return Response.json({ changed: body.entryIds.length });
  };

serveApi(
  routes({
    "GET /waitlist/admin/tags": () => Response.json(stored),
    "POST /waitlist/admin/tags": async ({ request }) => {
      calls.push("create");
      const body: { name: string } = await request.json();
      const created = { id: 6, name: body.name, entryCount: 0 };
      stored = [...stored, created];
      return Response.json(created);
    },
    "POST /waitlist/admin/tags/:id/add": changeEntries("add"),
    "POST /waitlist/admin/tags/:id/remove": changeEntries("remove"),
    "PATCH /waitlist/admin/tags/:id": async ({ request, params }) => {
      if (writeStatus !== 200) return refuse();
      const body: { name: string } = await request.json();
      stored = stored.map((t) =>
        String(t.id) === params.id ? { ...t, name: body.name } : t,
      );
      return Response.json(null);
    },
    "DELETE /waitlist/admin/tags/:id": ({ params }) => {
      if (writeStatus !== 200) return refuse();
      stored = stored.filter((t) => String(t.id) !== params.id);
      return Response.json(null);
    },
  }),
);

afterEach(() => {
  stored = [tag];
  writeStatus = 200;
  calls.length = 0;
});

const renderWith = <T>(useMutationHook: () => T) => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.waitlistEntriesAdminAll(), []);
  const view = renderHook(
    () => ({ tags: useWaitlistTagsAdmin(), mutation: useMutationHook() }),
    query,
  );
  const entriesInvalidated = () =>
    query.client.getQueryState(queryKeys.waitlistEntriesAdminAll())
      ?.isInvalidated;
  return { view, entriesInvalidated };
};

describe("useWaitlistTagsAdmin", () => {
  it("loads the tags", async () => {
    const view = renderHook(() => useWaitlistTagsAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual([tag]));
  });
});

describe("useChangeWaitlistEntryTagsAdmin", () => {
  const callbacks = () => ({
    onTagReady: jest.fn(() => calls.push("ready")),
    onSuccess: jest.fn(),
    onError: jest.fn(),
    onSettled: jest.fn(),
  });

  it("adds an existing tag to the entries", async () => {
    const cb = callbacks();
    const { view, entriesInvalidated } = renderWith(() =>
      useChangeWaitlistEntryTagsAdmin(cb),
    );
    await waitFor(() => expect(view.result.current.tags.data).toBeTruthy());

    view.result.current.mutation.mutate({ tag, add: true, entryIds: [1, 2] });

    await waitFor(() => expect(cb.onSettled).toHaveBeenCalled());
    expect(calls).toEqual(["ready", "add 5"]);
    expect(cb.onSuccess).toHaveBeenCalledWith({ tag, add: true, changed: 2 });
    await waitFor(() => expect(entriesInvalidated()).toBe(true));
  });

  it("creates a new tag before adding it", async () => {
    const cb = callbacks();
    const { view } = renderWith(() => useChangeWaitlistEntryTagsAdmin(cb));
    await waitFor(() => expect(view.result.current.tags.data).toBeTruthy());

    view.result.current.mutation.mutate({
      tag: { name: "Partner" },
      add: true,
      entryIds: [1],
    });

    await waitFor(() =>
      expect(view.result.current.tags.data?.map((t) => t.name)).toEqual([
        "Press",
        "Partner",
      ]),
    );
    expect(calls).toEqual(["create", "ready", "add 6"]);
    expect(cb.onSuccess).toHaveBeenCalledWith({
      tag: { id: 6, name: "Partner", entryCount: 0 },
      add: true,
      changed: 1,
    });
  });

  it("removes a tag from the entries", async () => {
    const cb = callbacks();
    const { view } = renderWith(() => useChangeWaitlistEntryTagsAdmin(cb));
    await waitFor(() => expect(view.result.current.tags.data).toBeTruthy());

    view.result.current.mutation.mutate({ tag, add: false, entryIds: [1] });

    await waitFor(() => expect(cb.onSuccess).toHaveBeenCalled());
    expect(calls).toEqual(["ready", "remove 5"]);
    expect(cb.onSuccess).toHaveBeenCalledWith({ tag, add: false, changed: 1 });
  });

  it("refetches after a refused change", async () => {
    writeStatus = 409;
    const cb = callbacks();
    const { view, entriesInvalidated } = renderWith(() =>
      useChangeWaitlistEntryTagsAdmin(cb),
    );
    await waitFor(() => expect(view.result.current.tags.data).toBeTruthy());

    view.result.current.mutation.mutate({ tag, add: true, entryIds: [1] });

    await waitFor(() =>
      expect(view.result.current.tags.data?.[0].name).toBe("Changed elsewhere"),
    );
    expect(cb.onError).toHaveBeenCalled();
    expect(cb.onSuccess).not.toHaveBeenCalled();
    expect(cb.onSettled).toHaveBeenCalled();
    expect(entriesInvalidated()).toBe(true);
  });
});

describe("useRenameWaitlistTagAdmin", () => {
  it("refetches the renamed tag", async () => {
    const onError = jest.fn();
    const { view, entriesInvalidated } = renderWith(() =>
      useRenameWaitlistTagAdmin({ onError }),
    );
    await waitFor(() => expect(view.result.current.tags.data).toBeTruthy());

    view.result.current.mutation.mutate({ id: 5, name: "Media" });

    await waitFor(() =>
      expect(view.result.current.tags.data?.[0].name).toBe("Media"),
    );
    expect(entriesInvalidated()).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });

  it("refetches after a refused rename", async () => {
    writeStatus = 409;
    const onError = jest.fn();
    const { view } = renderWith(() => useRenameWaitlistTagAdmin({ onError }));
    await waitFor(() => expect(view.result.current.tags.data).toBeTruthy());

    view.result.current.mutation.mutate({ id: 5, name: "Media" });

    await waitFor(() =>
      expect(view.result.current.tags.data?.[0].name).toBe("Changed elsewhere"),
    );
    expect(onError).toHaveBeenCalled();
  });
});

describe("useDeleteWaitlistTagAdmin", () => {
  it("refetches without the deleted tag", async () => {
    const cb = { onError: jest.fn(), onSettled: jest.fn() };
    const { view, entriesInvalidated } = renderWith(() =>
      useDeleteWaitlistTagAdmin(cb),
    );
    await waitFor(() => expect(view.result.current.tags.data).toBeTruthy());

    view.result.current.mutation.mutate(5);

    await waitFor(() => expect(view.result.current.tags.data).toEqual([]));
    expect(entriesInvalidated()).toBe(true);
    expect(cb.onSettled).toHaveBeenCalled();
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it("refetches after a refused delete", async () => {
    writeStatus = 409;
    const cb = { onError: jest.fn(), onSettled: jest.fn() };
    const { view } = renderWith(() => useDeleteWaitlistTagAdmin(cb));
    await waitFor(() => expect(view.result.current.tags.data).toBeTruthy());

    view.result.current.mutation.mutate(5);

    await waitFor(() =>
      expect(view.result.current.tags.data?.[0].name).toBe("Changed elsewhere"),
    );
    expect(cb.onError).toHaveBeenCalled();
    expect(cb.onSettled).toHaveBeenCalled();
  });
});
