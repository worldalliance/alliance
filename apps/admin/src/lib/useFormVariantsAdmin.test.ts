import type {
  ActionFormVariantDto,
  ActionFormVariantsListDto,
  CreateActionFormVariantDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeFormVariant } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "bun:test";
import { useFormVariantsAdmin } from "./useFormVariantsAdmin";

const variant = (id: number, name: string): ActionFormVariantDto =>
  makeFormVariant({ id, formId: id + 10, name });

let stored: ActionFormVariantDto[] = [];
let loadStatus = 200;
let refusedName: string | null = null;
let unreachableName: string | null = null;
let writeStatus = 200;

serveApi(
  routes({
    "GET /actions/:id/form-variants": () =>
      loadStatus === 200
        ? Response.json({ variants: stored, stats: [] })
        : Response.json({}, { status: loadStatus }),
    "POST /actions/:id/form-variants": async ({ request }) => {
      const body: CreateActionFormVariantDto = await request.json();
      if (body.name === unreachableName) throw new TypeError("Failed to fetch");
      if (body.name === refusedName) {
        return Response.json(
          { message: "Splits exceed 100%" },
          { status: 400 },
        );
      }
      const created = variant(stored.length + 1, body.name);
      stored = [...stored, created];
      return Response.json(created);
    },
    "PATCH /actions/form-variants/:variantId": async ({ request, params }) => {
      if (writeStatus !== 200) {
        return Response.json({}, { status: writeStatus });
      }
      const body: { name: string } = await request.json();
      stored = stored.map((v) =>
        v.id === Number(params.variantId) ? { ...v, name: body.name } : v,
      );
      return Response.json(stored[0]);
    },
    "DELETE /actions/form-variants/:variantId": ({ params }) => {
      stored = stored.filter((v) => v.id !== Number(params.variantId));
      return Response.json({});
    },
  }),
);

beforeEach(() => {
  stored = [variant(1, "A")];
  loadStatus = 200;
  refusedName = null;
  unreachableName = null;
  writeStatus = 200;
});

const whole = (list: ActionFormVariantsListDto) => list;

const loaded = async (query = queryWrapper()) => {
  query.client.setQueryData(queryKeys.formsAdmin(), []);
  const view = renderHook(() => useFormVariantsAdmin(2, whole), query);
  await waitFor(() => expect(view.result.current.variants.data).toBeDefined());
  return view;
};

const names = (view: Awaited<ReturnType<typeof loaded>>) =>
  view.result.current.variants.data?.variants.map((v) => v.name);

const formsIndexInvalidated = (query: ReturnType<typeof queryWrapper>) =>
  query.client.getQueryState(queryKeys.formsAdmin())?.isInvalidated;

const draft = (name: string) => ({ name, splitValue: 0.2, sourceFormId: 9 });

describe("useFormVariantsAdmin", () => {
  it("fails the load when the server refuses it", async () => {
    loadStatus = 500;
    const view = renderHook(
      () => useFormVariantsAdmin(2, whole),
      queryWrapper(),
    );
    await waitFor(() =>
      expect(view.result.current.variants.isError).toBe(true),
    );
  });

  it("publishes every draft and reloads the variants and the form index", async () => {
    const query = queryWrapper();
    const view = await loaded(query);

    const sent = await act(() =>
      view.result.current.publishVariants.mutateAsync([draft("B"), draft("C")]),
    );

    expect(sent).toEqual({ published: 2, refusal: null });
    await waitFor(() => expect(names(view)).toEqual(["A", "B", "C"]));
    expect(formsIndexInvalidated(query)).toBe(true);
  });

  it("stops publishing at the first refused draft", async () => {
    refusedName = "C";
    const view = await loaded();

    const sent = await act(() =>
      view.result.current.publishVariants.mutateAsync([
        draft("B"),
        draft("C"),
        draft("D"),
      ]),
    );

    expect(sent).toMatchObject({
      published: 1,
      refusal: { message: "Splits exceed 100%", statusCode: 400 },
    });
    await waitFor(() => expect(names(view)).toEqual(["A", "B"]));
  });

  it("counts the drafts published before a request that never reached the server", async () => {
    unreachableName = "C";
    const view = await loaded();

    const sent = await act(() =>
      view.result.current.publishVariants.mutateAsync([draft("B"), draft("C")]),
    );

    expect(sent).toMatchObject({ published: 1, refusal: expect.anything() });
    await waitFor(() => expect(names(view)).toEqual(["A", "B"]));
  });

  it("reloads the variants after an edit", async () => {
    const query = queryWrapper();
    const view = await loaded(query);

    await act(() =>
      view.result.current.updateVariant.mutateAsync({
        variantId: 1,
        body: { name: "Renamed" },
      }),
    );

    await waitFor(() => expect(names(view)).toEqual(["Renamed"]));
    expect(formsIndexInvalidated(query)).toBe(false);
  });

  it("rejects a refused edit", async () => {
    writeStatus = 400;
    const view = await loaded();

    await act(() =>
      expect(
        view.result.current.updateVariant.mutateAsync({
          variantId: 1,
          body: { name: "Renamed" },
        }),
      ).rejects.toMatchObject({ statusCode: 400 }),
    );
  });

  it("reloads the variants and the form index after a delete", async () => {
    const query = queryWrapper();
    const view = await loaded(query);

    await act(() => view.result.current.deleteVariant.mutateAsync(1));

    await waitFor(() => expect(names(view)).toEqual([]));
    expect(formsIndexInvalidated(query)).toBe(true);
  });
});
