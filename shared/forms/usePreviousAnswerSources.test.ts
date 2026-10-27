import { type FormSchema } from "@alliance/common/forms/form-schema";
import { renderHook, waitFor } from "@testing-library/react";
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
    renderHook(() =>
      usePreviousAnswerSources({ signedIn, previewUserId, schema: readsForm9 }),
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
      { initialProps: { schema: readsForm9 } },
    );
    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );

    rerender({ schema: { pages: [], outputViews: [] } });
    rerender({ schema: readsForm9 });

    expect(result.current.previousAnswersPending).toBe(true);
  });

  const notSubmitted = {
    "GET /tasks/slug/:id": () =>
      Response.json({ id: 9, title: "Source", formSnapshotId: 1, schema: {} }),
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
});
