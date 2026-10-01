import type { ClusterAdminDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { useClustersAdmin } from "./useClustersAdmin";

afterEach(cleanup);

const cluster = (id: number, displayName: string) =>
  ({
    id,
    displayName,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    members: [{ id: id * 10, displayName: `Member ${id}` }],
  }) satisfies ClusterAdminDto;

serveApi(
  routes({
    "GET /cluster/admin": () => Response.json([cluster(1, "North")]),
  }),
);

describe("useClustersAdmin", () => {
  it("loads the clusters", async () => {
    const view = renderHook(() => useClustersAdmin(), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.data).toEqual([cluster(1, "North")]),
    );
  });
});
