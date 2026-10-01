import type { ExternalShareTargetDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { useExternalShareTargetsAdmin } from "./useExternalShareTargetsAdmin";

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

serveApi(
  routes({
    "GET /external-share-targets": () =>
      Response.json([target(1, "Partner A"), target(2, "Partner B")]),
  }),
);

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
