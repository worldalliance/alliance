import type { FormSchema } from "@alliance/common/forms/form-schema";
import { renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import {
  hasSettledSinceMount,
  useVisibilityContext,
} from "./useVisibilityContext";

const MOUNTED_AT = 1_000_000;

describe("hasSettledSinceMount", () => {
  it("has not settled before the query has ever run", () => {
    // react-query reports both timestamps as 0 until the first fetch resolves.
    expect(
      hasSettledSinceMount({ dataUpdatedAt: 0, errorUpdatedAt: 0 }, MOUNTED_AT),
    ).toBe(false);
  });

  it("has not settled while a cached value from before this mount is served", () => {
    // The case `refetchOnMount: "always"` creates: data exists, so react-query
    // reports isLoading false, but the value predates this mount.
    expect(
      hasSettledSinceMount(
        { dataUpdatedAt: MOUNTED_AT - 1, errorUpdatedAt: 0 },
        MOUNTED_AT,
      ),
    ).toBe(false);
  });

  it("settles once a fetch resolves at or after the mount", () => {
    expect(
      hasSettledSinceMount(
        { dataUpdatedAt: MOUNTED_AT, errorUpdatedAt: 0 },
        MOUNTED_AT,
      ),
    ).toBe(true);
    expect(
      hasSettledSinceMount(
        { dataUpdatedAt: MOUNTED_AT + 50, errorUpdatedAt: 0 },
        MOUNTED_AT,
      ),
    ).toBe(true);
  });

  it("settles on a failed refetch rather than waiting forever", () => {
    expect(
      hasSettledSinceMount(
        { dataUpdatedAt: 0, errorUpdatedAt: MOUNTED_AT + 50 },
        MOUNTED_AT,
      ),
    ).toBe(true);
    // Stale data plus a failed refetch: fall through to the stale values.
    expect(
      hasSettledSinceMount(
        { dataUpdatedAt: MOUNTED_AT - 1, errorUpdatedAt: MOUNTED_AT + 50 },
        MOUNTED_AT,
      ),
    ).toBe(true);
  });

  it("stays settled for an error that predates the mount", () => {
    expect(
      hasSettledSinceMount(
        { dataUpdatedAt: 0, errorUpdatedAt: MOUNTED_AT - 1 },
        MOUNTED_AT,
      ),
    ).toBe(false);
  });
});

describe("useVisibilityContext", () => {
  const context = (completedActionCount: number) =>
    Response.json({
      userHasCity: false,
      userPropertyHasValue: {},
      firstContractSignedAt: null,
      completedActionCount,
    });
  serveApi(
    routes({
      "GET /user/myvisibilitycontext": () => context(1),
      "GET /user/7/visibilitycontext": () => context(7),
    }),
  );
  const schema: FormSchema = {
    pages: [
      {
        id: "p1",
        fields: [],
        visibleIfFormula: {
          conditions: { c1: { kind: "completedActionCount", atLeast: 3 } },
          formula: "c1",
        },
      },
    ],
    outputViews: [],
  };

  const countFor = async (previewUserId?: string | number) => {
    const { result } = renderHook(
      () => useVisibilityContext(schema, { enabled: true, previewUserId }),
      queryWrapper(),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    return result.current.completedActionCount;
  };

  it("reads the previewed member's account rather than the admin's", async () => {
    expect(await countFor(7)).toBe(7);
    expect(await countFor("7")).toBe(7);
  });

  it("reads the viewer's own account without a member to preview", async () => {
    expect(await countFor()).toBe(1);
    expect(await countFor("preview")).toBe(1);
  });
});
