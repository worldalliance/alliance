import { type FormSchema } from "@alliance/common/forms/form-schema";
import { renderHook, waitFor } from "@testing-library/react";
import { routes, serveApi } from "../lib/testing/serveApi";
import { useVisibilityValidatorResults } from "./useVisibilityValidatorResults";

const api = serveApi(routes({}));

describe("useVisibilityValidatorResults", () => {
  const gatedSchema: FormSchema = {
    pages: [
      {
        id: "p1",
        fields: [],
        visibleIfFormula: {
          conditions: { c1: { kind: "validator", validatorId: 42 } },
          formula: "c1",
        },
      },
    ],
    outputViews: [],
  };

  it("replays a completed response's saved verdicts", () => {
    const { result } = renderHook(() =>
      useVisibilityValidatorResults({
        schema: gatedSchema,
        readOnly: true,
        signedIn: true,
        savedResults: { 42: false },
      }),
    );
    expect(result.current.results[42]).toBe(false);
  });

  // A response saved before the validator existed has no verdict for it, and a
  // missing verdict evaluates as hidden, which would blank out a page the
  // submitter actually filled in.
  it("treats a validator the saved response never recorded as passing", () => {
    const { result } = renderHook(() =>
      useVisibilityValidatorResults({
        schema: gatedSchema,
        readOnly: true,
        signedIn: true,
        savedResults: {},
      }),
    );
    expect(result.current.results[42]).toBe(true);
  });

  it("says a run failed rather than leave its hidden verdict unexplained", async () => {
    const original = console.error;
    console.error = () => {};
    try {
      api.alsoServing({
        "POST /tasks/runValidator/:id": () =>
          Response.json({ message: "down" }, { status: 500 }),
      });
      const { result } = renderHook(() =>
        useVisibilityValidatorResults({
          schema: gatedSchema,
          readOnly: false,
          signedIn: true,
        }),
      );

      expect(result.current.failed).toBe(false);
      await waitFor(() => expect(result.current.failed).toBe(true));
      expect(result.current.results[42]).toBe(false);
    } finally {
      console.error = original;
    }
  });

  it("forgets a failed run once the validator, removed and added back, passes", async () => {
    const original = console.error;
    console.error = () => {};
    try {
      let runs = 0;
      api.alsoServing({
        "POST /tasks/runValidator/:id": () => {
          runs += 1;
          return runs === 1
            ? Response.json({ message: "down" }, { status: 500 })
            : Response.json({ isValid: true });
        },
      });
      const { result, rerender } = renderHook(
        ({ schema }) =>
          useVisibilityValidatorResults({
            schema,
            readOnly: false,
            signedIn: true,
          }),
        { initialProps: { schema: gatedSchema } },
      );
      await waitFor(() => expect(result.current.failed).toBe(true));

      rerender({ schema: { pages: [], outputViews: [] } });
      rerender({ schema: gatedSchema });

      await waitFor(() => expect(result.current.results[42]).toBe(true));
      expect(result.current.failed).toBe(false);
    } finally {
      console.error = original;
    }
  });

  it("fails a guest's validators without running them", () => {
    let ran = false;
    api.alsoServing({
      "POST /tasks/runValidator/:id": () => {
        ran = true;
        return Response.json({ isValid: true });
      },
    });
    const { result } = renderHook(() =>
      useVisibilityValidatorResults({
        schema: gatedSchema,
        readOnly: false,
        signedIn: false,
      }),
    );

    expect(result.current).toEqual({ results: { 42: false }, failed: false });
    expect(ran).toBe(false);
  });

  it("falls back to passing when the saved verdict is unreadable", () => {
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => logged.push(args);
    try {
      const { result } = renderHook(() =>
        useVisibilityValidatorResults({
          schema: gatedSchema,
          readOnly: true,
          signedIn: true,
          savedResults: { 42: "not a boolean" },
        }),
      );
      expect(result.current.results[42]).toBe(true);
      expect(logged).toHaveLength(1);
    } finally {
      console.error = original;
    }
  });

  it("runs for the previewed member, again for each member previewed", async () => {
    const ranFor: string[] = [];
    api.alsoServing({
      "POST /tasks/runValidator/:id": () => {
        ranFor.push("admin");
        return Response.json({ isValid: false });
      },
      "POST /tasks/runValidator/:id/asUser/:userId": ({ params }) => {
        ranFor.push(params.userId);
        return Response.json({ isValid: params.userId === "7" });
      },
    });
    const { result, rerender } = renderHook(
      ({ previewUserId }) =>
        useVisibilityValidatorResults({
          schema: gatedSchema,
          readOnly: false,
          signedIn: true,
          previewUserId,
        }),
      { initialProps: { previewUserId: 7 } },
    );
    await waitFor(() => expect(result.current.results[42]).toBe(true));

    rerender({ previewUserId: 8 });

    await waitFor(() => expect(result.current.results[42]).toBe(false));
    expect(ranFor).toEqual(["7", "8"]);
  });
});
