import { type FormSchema } from "@alliance/common/forms/form-schema";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "../lib/testing/queryWrapper";
import { routes, serveApi } from "../lib/testing/serveApi";
import { usePreviousAnswerSources } from "./usePreviousAnswerSources";

const pickSchema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "pick",
          type: "input",
          kind: "multiselect",
          label: "Pick",
          options: [],
          optionsFormula: { inputs: {}, formula: "[]" },
        },
      ],
    },
  ],
  outputViews: [],
};
const savedPick = [{ label: "Saved A", value: "a" }];

const api = serveApi(
  routes({
    "GET /tasks/slug/:id": () =>
      Response.json({
        id: 9,
        title: "Source",
        formSnapshotId: 1,
        schema: pickSchema,
      }),
    "GET /tasks/myResponse/:id": () =>
      Response.json({
        id: 1,
        formId: 9,
        formSnapshotId: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        answers: { pick: ["a"] },
        publicAnswers: {},
        schemaSnapshot: {},
        visibilityValidatorResults: {},
        formulaChoices: { pick: savedPick },
      }),
  }),
);

const settle = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

describe("usePreviousAnswerSources", () => {
  const previewResponse = {
    id: 1,
    formId: 9,
    formSnapshotId: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    answers: { pick: ["a"] },
    publicAnswers: {},
    schemaSnapshot: {},
    visibilityValidatorResults: {},
    formulaChoices: {},
  };

  const readsForm9: FormSchema = {
    pages: [
      {
        id: "p1",
        fields: [
          {
            id: "previous",
            type: "display",
            kind: "previousAnswer",
            sourceFormId: 9,
            sourceFieldId: "pick",
            showLabel: true,
          },
        ],
      },
    ],
    outputViews: [],
  };

  const renderSources = (signedIn = true, previewUserId?: number) =>
    renderHook(
      () =>
        usePreviousAnswerSources({
          signedIn,
          previewUserId,
          schema: readsForm9,
        }),
      queryWrapper(),
    );

  it("reads a source response's formula answers with the choices it saved", async () => {
    const { result } = renderSources();

    expect(result.current.previousAnswersPending).toBe(true);
    await waitFor(() =>
      expect(result.current.previousAnswerData[9]).toEqual({ pick: ["a"] }),
    );
    expect(result.current.previousAnswersPending).toBe(false);
    const [pick] = result.current.previousAnswerSchemas[9].pages[0].fields;
    expect(pick).toMatchObject({
      options: savedPick,
      optionsFormula: undefined,
    });
  });

  it("is pending again while a source form read before reloads", async () => {
    const { result, rerender } = renderHook(
      ({ schema }) => usePreviousAnswerSources({ signedIn: true, schema }),
      { ...queryWrapper(), initialProps: { schema: readsForm9 } },
    );
    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );

    rerender({ schema: { pages: [], outputViews: [] } });
    await settle();
    rerender({ schema: readsForm9 });

    expect(result.current.previousAnswersPending).toBe(true);
  });

  const notSubmitted = {
    "GET /tasks/slug/:id": () =>
      Response.json({ id: 9, title: "Source", formSnapshotId: 1, schema: {} }),
    "GET /tasks/myResponse/:id": () =>
      Response.json({ message: "Form response not found" }, { status: 404 }),
  };

  const deletedSource = {
    "GET /tasks/slug/:id": () =>
      Response.json({ message: "Form not found" }, { status: 404 }),
    "GET /tasks/myResponse/:id": () =>
      Response.json({ message: "Form response not found" }, { status: 404 }),
  };

  it.each([
    ["web", () => api.alsoServing(notSubmitted)],
    ["mobile", () => api.throwingOnRefusal(notSubmitted)],
  ])(
    "has loaded a source form the member never submitted, on %s",
    async (_, serve) => {
      serve();
      const { result } = renderSources();

      await waitFor(() =>
        expect(result.current.previousAnswersPending).toBe(false),
      );
      expect(result.current.previousAnswerData).toEqual({});
    },
  );

  it.each([
    ["web", () => api.alsoServing(deletedSource)],
    ["mobile", () => api.throwingOnRefusal(deletedSource)],
  ])("has loaded a source form that was deleted, on %s", async (_, serve) => {
    serve();
    const { result } = renderSources();

    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );
    expect(result.current.previousAnswerSchemas).toEqual({});
  });

  it("has loaded a guest's source forms without asking for their responses", async () => {
    let asked = false;
    api.alsoServing({
      "GET /tasks/myResponse/:id": () => {
        asked = true;
        return Response.json({ message: "Unauthorized" }, { status: 401 });
      },
    });
    const { result } = renderSources(false);

    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );
    expect(asked).toBe(false);
  });

  it("loads the member's answers when a mounted form's guest turns out to be signed in", async () => {
    const { result, rerender } = renderHook(
      ({ signedIn }) =>
        usePreviousAnswerSources({ signedIn, schema: readsForm9 }),
      { ...queryWrapper(), initialProps: { signedIn: false } },
    );
    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );

    rerender({ signedIn: true });

    expect(result.current.previousAnswersPending).toBe(true);
    await waitFor(() =>
      expect(result.current.previousAnswerData[9]).toEqual({ pick: ["a"] }),
    );
  });

  it("has loaded, for an admin preview, a member who never submitted the source form", async () => {
    api.alsoServing({
      "GET /tasks/responses/:id": () =>
        Response.json([{ ...previewResponse, user: { id: 99 } }]),
    });
    const { result } = renderSources(true, 3);

    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );
    expect(result.current.previousAnswerData).toEqual({});
  });

  it("reads, for an admin preview, the member's formula answers with the choices they saved", async () => {
    api.alsoServing({
      "GET /tasks/responses/:id": () =>
        Response.json([
          {
            ...previewResponse,
            user: { id: 3 },
            formulaChoices: { pick: savedPick },
          },
        ]),
    });
    const { result } = renderSources(true, 3);

    await waitFor(() =>
      expect(result.current.previousAnswerData[9]).toEqual({ pick: ["a"] }),
    );
    const [pick] = result.current.previousAnswerSchemas[9].pages[0].fields;
    expect(pick).toMatchObject({
      options: savedPick,
      optionsFormula: undefined,
    });
  });

  it("stays loading, for an admin preview, after the source responses fail to load", async () => {
    let failed = false;
    api.alsoServing({
      "GET /tasks/responses/:id": () => {
        failed = true;
        return Response.json({ message: "down" }, { status: 500 });
      },
    });
    const { result } = renderSources(true, 3);

    await waitFor(() => expect(failed).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.previousAnswersPending).toBe(true);
  });

  it("stays loading after a source response fails to load", async () => {
    let failed = false;
    api.alsoServing({
      "GET /tasks/myResponse/:id": () => {
        failed = true;
        return Response.json({ message: "down" }, { status: 500 });
      },
    });
    const { result } = renderSources();

    await waitFor(() => expect(failed).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.previousAnswersPending).toBe(true);
  });

  const countingResponses = () => {
    let asked = 0;
    api.alsoServing({
      "GET /tasks/myResponse/:id": () => {
        asked += 1;
        return Response.json({ ...previewResponse, id: asked });
      },
    });
    return () => asked;
  };

  it("loads only a source form added while open, keeping the ones loaded", async () => {
    const reads: string[] = [];
    api.alsoServing({
      "GET /tasks/myResponse/:id": ({ params }) => {
        reads.push(String(params.id));
        return Response.json(previewResponse);
      },
    });
    const readsForm10: FormSchema = {
      pages: [
        {
          id: "p1",
          fields: [
            ...readsForm9.pages[0].fields,
            {
              id: "other",
              type: "display",
              kind: "previousAnswer",
              sourceFormId: 10,
              sourceFieldId: "pick",
              showLabel: true,
            },
          ],
        },
      ],
      outputViews: [],
    };
    const { result, rerender } = renderHook(
      ({ schema }) => usePreviousAnswerSources({ signedIn: true, schema }),
      { ...queryWrapper(), initialProps: { schema: readsForm9 } },
    );
    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );

    rerender({ schema: readsForm10 });

    expect(result.current.previousAnswersPending).toBe(true);
    expect(result.current.previousAnswerData[9]).toEqual({ pick: ["a"] });
    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );
    expect(reads).toEqual(["9", "10"]);
  });

  it("drops a late answer for the member an admin switched away from", async () => {
    const late = Promise.withResolvers<Response>();
    let asked = false;
    api.alsoServing({
      "GET /tasks/responses/:id": () => {
        asked = true;
        return late.promise;
      },
    });
    const { result, rerender } = renderHook(
      ({ previewUserId }) =>
        usePreviousAnswerSources({
          signedIn: true,
          previewUserId,
          schema: readsForm9,
        }),
      { ...queryWrapper(), initialProps: { previewUserId: 3 } },
    );
    await waitFor(() => expect(asked).toBe(true));

    api.alsoServing({
      "GET /tasks/responses/:id": () =>
        Response.json([{ ...previewResponse, user: { id: 4 } }]),
    });
    rerender({ previewUserId: 4 });
    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );

    late.resolve(
      Response.json([
        { ...previewResponse, user: { id: 3 }, answers: { pick: ["late"] } },
      ]),
    );
    await settle();
    expect(result.current.previousAnswerData).toEqual({ 9: { pick: ["a"] } });
  });

  it("doesn't retry a failed load on its own, whatever the app's retries", async () => {
    let asked = 0;
    api.alsoServing({
      "GET /tasks/myResponse/:id": () => {
        asked += 1;
        return Response.json({ message: "down" }, { status: 500 });
      },
    });
    const { result } = renderHook(
      () => usePreviousAnswerSources({ signedIn: true, schema: readsForm9 }),
      queryWrapper({ retry: 3, retryDelay: 0 }),
    );

    await waitFor(() => expect(asked).toBe(1));
    await settle();
    await settle();
    expect(asked).toBe(1);
    expect(result.current.previousAnswersPending).toBe(true);
  });

  it("fails rather than waiting for the network while offline", async () => {
    onlineManager.setOnline(false);
    try {
      const asked = countingResponses();
      renderSources();

      await waitFor(() => expect(asked()).toBe(1));
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it("keeps an open form's sources when the window regains focus", async () => {
    const asked = countingResponses();
    const { result } = renderSources();
    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );

    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    focusManager.setFocused(undefined);
    await settle();

    expect(asked()).toBe(1);
  });

  it("recovers from a failed load when the window regains focus", async () => {
    let down = true;
    api.alsoServing({
      "GET /tasks/myResponse/:id": () =>
        down
          ? Response.json({ message: "down" }, { status: 500 })
          : Response.json(previewResponse),
    });
    const { result } = renderSources();
    await waitFor(() =>
      expect(result.current.previousAnswerSchemas).toEqual({}),
    );
    await settle();
    await settle();
    expect(result.current.previousAnswersPending).toBe(true);

    down = false;
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    focusManager.setFocused(undefined);

    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );
    expect(result.current.previousAnswerData[9]).toEqual({ pick: ["a"] });
  });

  it("loads afresh for a form opened while another reading the same source stays open", async () => {
    const asked = countingResponses();
    const shared = queryWrapper();
    const open = () =>
      renderHook(
        () => usePreviousAnswerSources({ signedIn: true, schema: readsForm9 }),
        shared,
      );
    const first = open();
    await waitFor(() =>
      expect(first.result.current.previousAnswersPending).toBe(false),
    );

    const second = open();

    expect(second.result.current.previousAnswersPending).toBe(true);
    await waitFor(() => expect(asked()).toBe(2));
  });

  it("loads afresh when the form reopens, whatever the app's staleTime", async () => {
    const asked = countingResponses();
    const shared = queryWrapper({ staleTime: Infinity });
    const open = () =>
      renderHook(
        () => usePreviousAnswerSources({ signedIn: true, schema: readsForm9 }),
        shared,
      );
    const first = open();
    await waitFor(() =>
      expect(first.result.current.previousAnswersPending).toBe(false),
    );
    first.unmount();
    await settle();

    open();

    await waitFor(() => expect(asked()).toBe(2));
  });

  it("keeps its result between renders, whatever the schema's identity", async () => {
    const asked = countingResponses();
    const { result, rerender } = renderHook(
      ({ schema }) => usePreviousAnswerSources({ signedIn: true, schema }),
      { ...queryWrapper(), initialProps: { schema: readsForm9 } },
    );
    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );
    const loaded = result.current;

    rerender({ schema: { ...readsForm9 } });

    expect(result.current).toBe(loaded);
    expect(asked()).toBe(1);
  });
});
