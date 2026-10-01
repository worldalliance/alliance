import type {
  CreateExternalShareTargetDto,
  ExternalShareTargetDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  useCreateExternalShareTargetAdmin,
  useDeleteExternalShareTargetAdmin,
  useExternalShareTargetsAdmin,
  useUpdateExternalShareTargetAdmin,
} from "./useExternalShareTargetsAdmin";

afterEach(cleanup);

const target = (id: number, name: string) =>
  ({
    id,
    name,
    url: `https://example.com/${id}`,
    paramName: "code",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  }) satisfies ExternalShareTargetDto;

let stored: ExternalShareTargetDto[] = [];
let loadGate = Promise.resolve();
let createGate = Promise.resolve();
let deleteStatus = 200;
const updates: { id: string; body: unknown }[] = [];

serveApi(
  routes({
    "GET /external-share-targets": () => {
      const snapshot = stored;
      return loadGate.then(() => Response.json(snapshot));
    },
    "POST /external-share-targets": async ({ request }) => {
      const body: CreateExternalShareTargetDto = await request.json();
      const created = { ...target(99, body.name), ...body };
      stored = [created, ...stored];
      return createGate.then(() => Response.json(created));
    },
    "PATCH /external-share-targets/:id": async ({ request, params }) => {
      const body: CreateExternalShareTargetDto = await request.json();
      updates.push({ id: params.id, body });
      return Response.json({
        ...target(Number(params.id), body.name),
        ...body,
      });
    },
    "DELETE /external-share-targets/:id": ({ params }) => {
      if (deleteStatus !== 200) {
        return Response.json({}, { status: deleteStatus });
      }
      stored = stored.filter((t) => String(t.id) !== params.id);
      return new Response(null, { status: 200 });
    },
  }),
);

beforeEach(() => {
  stored = [target(1, "Partner A"), target(2, "Partner B")];
  loadGate = Promise.resolve();
  createGate = Promise.resolve();
  deleteStatus = 200;
  updates.length = 0;
});

const partnerC = {
  name: "Partner C",
  url: "https://example.com/c",
  paramName: "ref",
};

const renderTargets = (query = queryWrapper(), onCreated = () => {}) => {
  const view = renderHook(
    () => ({
      targets: useExternalShareTargetsAdmin(),
      create: useCreateExternalShareTargetAdmin({
        onSuccess: onCreated,
        onError: () => {},
      }),
      update: useUpdateExternalShareTargetAdmin({ onError: () => {} }),
      remove: useDeleteExternalShareTargetAdmin({ onError: () => {} }),
    }),
    query,
  );
  return { view };
};

const cachedNames = (query: ReturnType<typeof queryWrapper>) =>
  query.client
    .getQueryData<
      ExternalShareTargetDto[]
    >(queryKeys.externalShareTargetsAdmin())
    ?.map((t) => t.name);

describe("useExternalShareTargetsAdmin", () => {
  it("loads the targets", async () => {
    const view = renderHook(
      () => useExternalShareTargetsAdmin(),
      queryWrapper(),
    );

    await waitFor(() =>
      expect(view.result.current.data).toEqual([
        target(1, "Partner A"),
        target(2, "Partner B"),
      ]),
    );
  });
});

describe("useCreateExternalShareTargetAdmin", () => {
  it("caches the created target first and then reports success", async () => {
    const query = queryWrapper();
    const onCreated = mock(() => cachedNames(query));
    const { view } = renderTargets(query, onCreated);
    await waitFor(() => expect(view.result.current.targets.data).toBeDefined());

    await view.result.current.create.mutateAsync(partnerC);

    expect(onCreated.mock.results).toEqual([
      { type: "return", value: ["Partner C", "Partner A", "Partner B"] },
    ]);
  });

  it("lists a target created while the first load is in flight", async () => {
    let releaseLoad = () => {};
    loadGate = new Promise((resolve) => (releaseLoad = resolve));
    const query = queryWrapper();
    const { view } = renderTargets(query);

    const create = view.result.current.create.mutateAsync(partnerC);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      releaseLoad();
      await create;
    });

    expect(cachedNames(query)).toEqual(["Partner C", "Partner A", "Partner B"]);
  });

  it("lists a created target once when a refetch already returned it", async () => {
    const query = queryWrapper();
    const { view } = renderTargets(query);
    await waitFor(() => expect(view.result.current.targets.data).toBeDefined());

    let releaseCreate = () => {};
    createGate = new Promise((resolve) => (releaseCreate = resolve));
    const create = view.result.current.create.mutateAsync(partnerC);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await query.client.refetchQueries();
      releaseCreate();
      await create;
    });

    expect(cachedNames(query)).toEqual(["Partner C", "Partner A", "Partner B"]);
  });
});

describe("useUpdateExternalShareTargetAdmin", () => {
  it("sends trimmed values and caches the updated target in place", async () => {
    const query = queryWrapper();
    const { view } = renderTargets(query);
    await waitFor(() => expect(view.result.current.targets.data).toBeDefined());

    await view.result.current.update.mutateAsync({
      id: 1,
      values: {
        name: " Partner Z ",
        url: " https://z.test ",
        paramName: " z ",
      },
    });

    expect(updates).toEqual([
      {
        id: "1",
        body: { name: "Partner Z", url: "https://z.test", paramName: "z" },
      },
    ]);
    expect(cachedNames(query)).toEqual(["Partner Z", "Partner B"]);
  });
});

describe("useDeleteExternalShareTargetAdmin", () => {
  it("drops a target another admin already deleted", async () => {
    deleteStatus = 404;
    const query = queryWrapper();
    const { view } = renderTargets(query);
    await waitFor(() => expect(view.result.current.targets.data).toBeDefined());

    await view.result.current.remove.mutateAsync(1);

    expect(cachedNames(query)).toEqual(["Partner B"]);
  });

  it("keeps the delete when a refetch started before it lands after it", async () => {
    const query = queryWrapper();
    const { view } = renderTargets(query);
    await waitFor(() => expect(view.result.current.targets.data).toBeDefined());

    let releaseLoad = () => {};
    loadGate = new Promise((resolve) => (releaseLoad = resolve));
    const refetch = query.client.refetchQueries();
    await view.result.current.remove.mutateAsync(1);

    await act(async () => {
      releaseLoad();
      await refetch;
    });

    expect(cachedNames(query)).toEqual(["Partner B"]);
  });
});
