import type { AdminWaitlistLinkDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useCreateWaitlistLinkAdmin,
  useUpdateWaitlistLinkAdmin,
  useWaitlistLinksAdmin,
} from "./useWaitlistLinksAdmin";

afterEach(cleanup);

const link = {
  id: 7,
  code: "newsletter1",
  organizationId: 3,
  channel: "Newsletter",
  publishedAt: null,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  entryCount: 0,
} satisfies AdminWaitlistLinkDto;

let stored: AdminWaitlistLinkDto[] = [link];
let writeStatus = 200;

serveApi(
  routes({
    "GET /waitlist/admin/links": () => Response.json(stored),
    "POST /waitlist/admin/links": async ({ request }) => {
      if (writeStatus !== 200)
        return Response.json({}, { status: writeStatus });
      const { channel }: { channel: string } = await request.json();
      const created = { ...link, id: 8, code: "podcast1", channel };
      stored = [...stored, created];
      return Response.json(created);
    },
    "PATCH /waitlist/admin/links/:id": async ({ request, params }) => {
      if (writeStatus !== 200) {
        stored = [{ ...link, channel: "Changed elsewhere" }];
        return Response.json({}, { status: writeStatus });
      }
      const { archived }: { archived?: boolean } = await request.json();
      stored = stored.map((l) =>
        String(l.id) === params.id
          ? { ...l, archivedAt: archived ? "2026-02-01T00:00:00.000Z" : null }
          : l,
      );
      return Response.json(null);
    },
  }),
);

afterEach(() => {
  stored = [link];
  writeStatus = 200;
});

describe("useWaitlistLinksAdmin", () => {
  it("loads the links", async () => {
    const view = renderHook(() => useWaitlistLinksAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual([link]));
  });
});

describe("useCreateWaitlistLinkAdmin", () => {
  const renderCreate = () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const view = renderHook(
      () => ({
        links: useWaitlistLinksAdmin(),
        create: useCreateWaitlistLinkAdmin({ onSuccess, onError }),
      }),
      queryWrapper(),
    );
    return { view, onSuccess, onError };
  };

  it("refetches the links after a create", async () => {
    const { view, onSuccess } = renderCreate();
    await waitFor(() => expect(view.result.current.links.data).toBeTruthy());

    view.result.current.create.mutate({
      organizationId: 3,
      channel: "Podcast",
      publishedAt: null,
    });

    await waitFor(() =>
      expect(view.result.current.links.data?.map((l) => l.channel)).toEqual([
        "Newsletter",
        "Podcast",
      ]),
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it("reports a refused create", async () => {
    writeStatus = 500;
    const { view, onSuccess, onError } = renderCreate();

    view.result.current.create.mutate({
      organizationId: 3,
      channel: "Podcast",
      publishedAt: null,
    });

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe("useUpdateWaitlistLinkAdmin", () => {
  const renderUpdate = () => {
    const onSettled = jest.fn();
    const onError = jest.fn();
    const view = renderHook(
      () => ({
        links: useWaitlistLinksAdmin(),
        update: useUpdateWaitlistLinkAdmin({ onSettled, onError }),
      }),
      queryWrapper(),
    );
    return { view, onSettled, onError };
  };

  it("refetches the links after an update", async () => {
    const { view, onSettled, onError } = renderUpdate();
    await waitFor(() => expect(view.result.current.links.data).toBeTruthy());

    view.result.current.update.mutate({ id: 7, body: { archived: true } });

    await waitFor(() =>
      expect(view.result.current.links.data?.[0].archivedAt).toBe(
        "2026-02-01T00:00:00.000Z",
      ),
    );
    expect(onSettled).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("refetches the links after a refused update", async () => {
    writeStatus = 409;
    const { view, onSettled, onError } = renderUpdate();
    await waitFor(() => expect(view.result.current.links.data).toBeTruthy());

    view.result.current.update.mutate({ id: 7, body: { channel: "Blog" } });

    await waitFor(() =>
      expect(view.result.current.links.data?.[0].channel).toBe(
        "Changed elsewhere",
      ),
    );
    expect(onError).toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalled();
  });
});
