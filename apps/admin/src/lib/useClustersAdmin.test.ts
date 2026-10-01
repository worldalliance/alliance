import type { ClusterAdminDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, mock } from "bun:test";
import { useClustersAdmin, useRenameClusterAdmin } from "./useClustersAdmin";

afterEach(cleanup);

const cluster = (id: number, displayName: string) =>
  ({
    id,
    displayName,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    members: [{ id: id * 10, displayName: `Member ${id}` }],
  }) satisfies ClusterAdminDto;

let holdLoad: Promise<void> | undefined;
const patches: { id: string; body: unknown }[] = [];

serveApi(
  routes({
    "GET /cluster/admin": async () => {
      await holdLoad;
      return Response.json([cluster(1, "North"), cluster(2, "South")]);
    },
    "PATCH /cluster/admin/:id": async ({ request, params }) => {
      patches.push({ id: params.id, body: await request.json() });
      return Response.json(cluster(1, "Northeast"));
    },
  }),
);

afterEach(() => {
  holdLoad = undefined;
  patches.length = 0;
});

const renderClusters = (query = queryWrapper()) => {
  const onSuccess = mock(() => {});
  const view = renderHook(
    () => ({
      clusters: useClustersAdmin(),
      rename: useRenameClusterAdmin({ onSuccess, onError: () => {} }),
    }),
    query,
  );
  return { view, onSuccess };
};

const names = (clusters: ClusterAdminDto[] | undefined) =>
  clusters?.map((c) => c.displayName);

describe("useClustersAdmin", () => {
  it("loads the clusters", async () => {
    const view = renderHook(() => useClustersAdmin(), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.data).toEqual([
        cluster(1, "North"),
        cluster(2, "South"),
      ]),
    );
  });
});

describe("useRenameClusterAdmin", () => {
  it("sends the name and caches the renamed cluster in place", async () => {
    const { view, onSuccess } = renderClusters();
    await waitFor(() =>
      expect(names(view.result.current.clusters.data)).toEqual([
        "North",
        "South",
      ]),
    );

    await view.result.current.rename.mutateAsync({
      id: 1,
      displayName: "Northeast",
    });

    expect(patches).toEqual([{ id: "1", body: { displayName: "Northeast" } }]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(names(view.result.current.clusters.data)).toEqual([
        "Northeast",
        "South",
      ]),
    );
  });

  it("keeps a rename that lands while a refetch is in flight", async () => {
    const query = queryWrapper();
    const { view } = renderClusters(query);
    await waitFor(() =>
      expect(view.result.current.clusters.data).toBeDefined(),
    );

    let release = () => {};
    holdLoad = new Promise((resolve) => (release = resolve));
    const refetch = query.client.refetchQueries();
    await view.result.current.rename.mutateAsync({
      id: 1,
      displayName: "Northeast",
    });

    await act(async () => {
      release();
      await refetch;
    });

    expect(names(query.client.getQueryData(queryKeys.clustersAdmin()))).toEqual(
      ["Northeast", "South"],
    );
  });
});
