import type { ShareUrlAdminDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { type ShareLinkOwner, useShareLinksAdmin } from "./useShareLinksAdmin";

afterEach(cleanup);

const link = (id: string, owner: ShareLinkOwner, label: string | null = null) =>
  ({
    id,
    kind: "action",
    sid: null,
    url: `https://example.com/${id}`,
    duplicate: true,
    label,
    userId: owner.type === "user" ? owner.id : null,
    campaignId: owner.type === "campaign" ? owner.id : null,
    createdAt: "2026-01-02T00:00:00.000Z",
    signupCount: 0,
    action: { id: 1, name: "Call your rep" },
  }) satisfies ShareUrlAdminDto;

const user: ShareLinkOwner = { type: "user", id: 5 };
const campaign: ShareLinkOwner = { type: "campaign", id: 7 };

let userStatus = 200;
let deleteStatus = 200;
let createBody: unknown;
const requested: string[] = [];

serveApi(
  routes({
    "GET /share-urls/for-user/:userId": ({ params }) => {
      requested.push(`user-${params.userId}`);
      return userStatus === 200
        ? Response.json([link("a", user), link("b", user)])
        : Response.json({}, { status: userStatus });
    },
    "GET /share-urls/for-campaign/:campaignId": ({ params }) => {
      requested.push(`campaign-${params.campaignId}`);
      return Response.json([link("c", campaign)]);
    },
    "PATCH /share-urls/:id/label": async ({ request, params }) => {
      const { label }: { label: string } = await request.json();
      return Response.json(link(params.id, user, label));
    },
    "DELETE /share-urls/:id": () =>
      deleteStatus === 200
        ? new Response(null, { status: 200 })
        : Response.json({}, { status: deleteStatus }),
    "POST /share-urls/create-duplicate": async ({ request }) => {
      createBody = await request.json();
      return Response.json(link("new", user, "Fresh"));
    },
  }),
);

beforeEach(() => {
  userStatus = 200;
  deleteStatus = 200;
  createBody = undefined;
  requested.length = 0;
});

const cachedIds = (
  query: ReturnType<typeof queryWrapper>,
  owner: ShareLinkOwner,
) =>
  query.client
    .getQueryData<ShareUrlAdminDto[]>(queryKeys.shareLinksAdmin(owner))
    ?.map((r) => r.id);

const renderLinks = (owner: ShareLinkOwner | null, query = queryWrapper()) =>
  renderHook(({ current }) => useShareLinksAdmin(current), {
    ...query,
    initialProps: { current: owner },
  });

describe("useShareLinksAdmin", () => {
  it("loads a user's links and a campaign's links", async () => {
    const view = renderLinks(user);
    await waitFor(() =>
      expect(view.result.current.links.data?.map((r) => r.id)).toEqual([
        "a",
        "b",
      ]),
    );

    view.rerender({ current: campaign });
    await waitFor(() =>
      expect(view.result.current.links.data?.map((r) => r.id)).toEqual(["c"]),
    );
  });

  it("requests nothing without an owner", async () => {
    const view = renderLinks(null);
    await act(async () => {});
    expect(view.result.current.links.fetchStatus).toBe("idle");
    expect(requested).toEqual([]);
  });

  it("reports a failed load", async () => {
    userStatus = 500;
    const view = renderLinks(user);
    await waitFor(() => expect(view.result.current.links.isError).toBe(true));
  });

  it("caches an updated label in its owner's list", async () => {
    const query = queryWrapper();
    const view = renderLinks(user, query);
    await waitFor(() => expect(view.result.current.links.data).toBeTruthy());

    await act(() =>
      view.result.current.updateLabel.mutateAsync({
        owner: user,
        id: "b",
        label: "Renamed",
      }),
    );

    await waitFor(() =>
      expect(view.result.current.links.data?.map((r) => r.label)).toEqual([
        null,
        "Renamed",
      ]),
    );
  });

  it("drops a deleted link, and one already gone, from its owner's list", async () => {
    const query = queryWrapper();
    const view = renderLinks(user, query);
    await waitFor(() => expect(view.result.current.links.data).toBeTruthy());

    await act(() =>
      view.result.current.remove.mutateAsync({ owner: user, id: "a" }),
    );
    expect(cachedIds(query, user)).toEqual(["b"]);

    deleteStatus = 404;
    await act(() =>
      view.result.current.remove.mutateAsync({ owner: user, id: "b" }),
    );
    expect(cachedIds(query, user)).toEqual([]);
  });

  it("rejects a refused delete and keeps the link", async () => {
    deleteStatus = 500;
    const query = queryWrapper();
    const view = renderLinks(user, query);
    await waitFor(() => expect(view.result.current.links.data).toBeTruthy());

    let failed = false;
    await act(() =>
      view.result.current.remove
        .mutateAsync({ owner: user, id: "a" })
        .catch(() => {
          failed = true;
        }),
    );
    expect(failed).toBe(true);
    expect(cachedIds(query, user)).toEqual(["a", "b"]);
  });

  it("creates a duplicate into the owner it was made for after the page moves on", async () => {
    const query = queryWrapper();
    const view = renderLinks(user, query);
    await waitFor(() => expect(view.result.current.links.data).toBeTruthy());

    const created = view.result.current.createDuplicate.mutateAsync({
      owner: user,
      target: { actionId: 1, label: "Fresh" },
    });
    view.rerender({ current: campaign });
    await act(() => created);

    expect(createBody).toEqual({ userId: 5, actionId: 1, label: "Fresh" });
    expect(cachedIds(query, user)).toEqual(["new", "a", "b"]);
    await waitFor(() => expect(cachedIds(query, campaign)).toEqual(["c"]));
  });

  it("names a campaign as the owner of a duplicate made for it", async () => {
    const query = queryWrapper();
    const view = renderLinks(campaign, query);
    await waitFor(() => expect(view.result.current.links.data).toBeTruthy());

    await act(() =>
      view.result.current.createDuplicate.mutateAsync({
        owner: campaign,
        target: { actionId: 1 },
      }),
    );

    expect(createBody).toEqual({ campaignId: 7, actionId: 1 });
  });

  it("renames and deletes in the owner they were made for after the page moves on", async () => {
    const query = queryWrapper();
    const view = renderLinks(user, query);
    await waitFor(() => expect(view.result.current.links.data).toBeTruthy());

    const renamed = view.result.current.updateLabel.mutateAsync({
      owner: user,
      id: "b",
      label: "Renamed",
    });
    const removed = view.result.current.remove.mutateAsync({
      owner: user,
      id: "a",
    });
    view.rerender({ current: campaign });
    await act(() => Promise.all([renamed, removed]));

    expect(
      query.client
        .getQueryData<ShareUrlAdminDto[]>(queryKeys.shareLinksAdmin(user))
        ?.map((r) => [r.id, r.label]),
    ).toEqual([["b", "Renamed"]]);
    await waitFor(() => expect(cachedIds(query, campaign)).toEqual(["c"]));
  });
});
