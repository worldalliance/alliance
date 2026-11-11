import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { FormVariable } from "@alliance/common/forms/variables";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { queryWrapper } from "../lib/testing/queryWrapper";
import { routes, serveApi } from "../lib/testing/serveApi";
import {
  AggregateReader,
  aggregateTarget,
  useVariableAggregates,
  VariableAggregatesStatus,
  type AggregateTarget,
  type VariableAggregates,
} from "./useVariableAggregates";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const counting = (...fieldIds: string[]): FormVariable => ({
  name: fieldIds.join("-"),
  inputs: Object.fromEntries(
    fieldIds.map((fieldId, index) => [
      `input${index + 1}`,
      { kind: "aggregate", sourceFormId: 7, fieldId },
    ]),
  ),
  formula: "0",
});

const answering = (fieldId: string): FormVariable => ({
  name: `answered-${fieldId}`,
  inputs: { input1: { kind: "answeredCount", sourceFormId: 7, fieldId } },
  formula: "input1",
});

const schemaWith = (variables: FormVariable[]): FormSchema => ({
  pages: [{ id: "p1", fields: [] }],
  outputViews: [],
  variables,
});

const aggregate = (fieldId: string, counts: Record<string, number> | null) => ({
  sourceFormId: 7,
  fieldId,
  counts,
});

let answer: () => Promise<Response>;
let requests: unknown[];

serveApi(
  routes({
    "GET /tasks/variableAggregates/:formId/snapshot/:formSnapshotId": ({
      params,
    }) => {
      requests.push(`${params.formId}@${params.formSnapshotId}`);
      return answer();
    },
    "POST /tasks/variableAggregates": async ({ request }) => {
      requests.push(await request.json());
      return answer();
    },
  }),
);

beforeEach(() => {
  answer = async () => json({ aggregates: [], answered: [] });
  requests = [];
});

const settle = async () => {
  for (let tick = 0; tick < 5; tick += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

const FORM_VERSION: AggregateTarget = {
  reader: AggregateReader.FormVersion,
  formId: 3,
  formSnapshotId: 4,
};

const render = (
  schema: FormSchema,
  target: AggregateTarget | undefined,
  wrapper = queryWrapper().wrapper,
) =>
  renderHook(
    (props: { schema: FormSchema }) =>
      useVariableAggregates({ schema: props.schema, target }),
    { initialProps: { schema }, wrapper },
  );

const countsOf = (aggregates: VariableAggregates, key: string) =>
  aggregates.status === VariableAggregatesStatus.Ready
    ? aggregates.aggregates.get(key)
    : aggregates.status;

describe("useVariableAggregates", () => {
  it("is ready at once for a form counting nothing", async () => {
    const { result } = render(schemaWith([]), FORM_VERSION);
    expect(result.current.status).toBe(VariableAggregatesStatus.Ready);
    await settle();
    expect(requests).toEqual([]);
  });

  it("loads every count in one request, however many inputs read them", async () => {
    answer = async () =>
      json({
        aggregates: [aggregate("a", { x: 2 }), aggregate("b", {})],
        answered: [],
      });
    const { result, rerender } = render(
      schemaWith([counting("a", "b"), counting("a")]),
      FORM_VERSION,
    );
    expect(result.current.status).toBe(VariableAggregatesStatus.Loading);
    await settle();
    expect(countsOf(result.current, "7:a")).toEqual({ x: 2 });
    expect(requests).toEqual(["3@4"]);

    rerender({ schema: schemaWith([counting("a", "b"), counting("a")]) });
    await settle();
    expect(requests).toEqual(["3@4"]);
  });

  it("sends an admin's own schema's questions", async () => {
    answer = async () =>
      json({ aggregates: [aggregate("a", {})], answered: [] });
    render(schemaWith([counting("a"), counting("a")]), {
      reader: AggregateReader.Admin,
    });
    await settle();
    expect(requests).toEqual([
      { sources: [{ sourceFormId: 7, fieldId: "a" }], answeredSources: [] },
    ]);
  });

  it("ignores counts for questions the schema no longer reads", async () => {
    let releaseFirst = () => {};
    answer = () =>
      new Promise((resolve) => {
        releaseFirst = () =>
          resolve(
            json({ aggregates: [aggregate("a", { x: 1 })], answered: [] }),
          );
      });
    const { result, rerender } = render(schemaWith([counting("a")]), {
      reader: AggregateReader.Admin,
    });
    await settle();

    answer = async () =>
      json({ aggregates: [aggregate("b", { x: 2 })], answered: [] });
    rerender({ schema: schemaWith([counting("b")]) });
    await settle();
    releaseFirst();
    await settle();

    expect(countsOf(result.current, "7:b")).toEqual({ x: 2 });
    expect(countsOf(result.current, "7:a")).toBeUndefined();
  });

  it("leaves an input with no question picked yet out of the request", async () => {
    answer = async () =>
      json({ aggregates: [aggregate("a", {})], answered: [] });
    const { result } = render(schemaWith([counting("a", "")]), {
      reader: AggregateReader.Admin,
    });
    await settle();
    expect(requests).toEqual([
      { sources: [{ sourceFormId: 7, fieldId: "a" }], answeredSources: [] },
    ]);
    expect(result.current.status).toBe(VariableAggregatesStatus.Ready);
  });

  it("fails on a load error, and retry fetches again", async () => {
    answer = async () => json({ message: "down" }, 500);
    const { result } = render(schemaWith([counting("a")]), FORM_VERSION);
    await settle();
    const failed = result.current;
    if (failed.status !== VariableAggregatesStatus.Failed) {
      throw new Error(`expected a failure, got ${failed.status}`);
    }

    answer = async () =>
      json({ aggregates: [aggregate("a", { x: 1 })], answered: [] });
    act(() => failed.retry());
    await settle();
    expect(countsOf(result.current, "7:a")).toEqual({ x: 1 });
    expect(requests).toHaveLength(2);
  });

  it("doesn't retry a failed load on its own, whatever the app's retries", async () => {
    answer = async () => json({ message: "down" }, 500);
    const { wrapper } = queryWrapper({ retry: 3, retryDelay: 0 });
    const { result } = render(
      schemaWith([counting("a")]),
      FORM_VERSION,
      wrapper,
    );
    await settle();
    expect(result.current.status).toBe(VariableAggregatesStatus.Failed);
    expect(requests).toHaveLength(1);
  });

  it("fails rather than waiting for the network while offline", async () => {
    onlineManager.setOnline(false);
    try {
      answer = () => Promise.reject(new TypeError("Failed to fetch"));
      const { result } = render(schemaWith([counting("a")]), FORM_VERSION);
      await settle();
      expect(result.current.status).toBe(VariableAggregatesStatus.Failed);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it("shows loading again while a retry is out", async () => {
    answer = async () => json({ message: "down" }, 500);
    const { result } = render(schemaWith([counting("a")]), FORM_VERSION);
    await settle();
    const failed = result.current;
    if (failed.status !== VariableAggregatesStatus.Failed) {
      throw new Error(`expected a failure, got ${failed.status}`);
    }

    answer = () => new Promise(() => {});
    act(() => failed.retry());
    await settle();
    expect(result.current.status).toBe(VariableAggregatesStatus.Loading);
  });

  it("keeps an open form's counts when the window regains focus", async () => {
    answer = async () =>
      json({ aggregates: [aggregate("a", { x: 1 })], answered: [] });
    const { result } = render(schemaWith([counting("a")]), FORM_VERSION);
    await settle();

    answer = async () =>
      json({ aggregates: [aggregate("a", { x: 2 })], answered: [] });
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await settle();
    focusManager.setFocused(undefined);
    expect(countsOf(result.current, "7:a")).toEqual({ x: 1 });
    expect(requests).toHaveLength(1);
  });

  it("loads the counts afresh when the form reopens, whatever the app's staleTime", async () => {
    const { wrapper } = queryWrapper({ staleTime: 5 * 60 * 1000 });
    answer = async () =>
      json({ aggregates: [aggregate("a", { x: 1 })], answered: [] });
    const first = render(schemaWith([counting("a")]), FORM_VERSION, wrapper);
    await settle();
    first.unmount();
    await settle();

    answer = async () =>
      json({ aggregates: [aggregate("a", { x: 2 })], answered: [] });
    const second = render(schemaWith([counting("a")]), FORM_VERSION, wrapper);
    expect(second.result.current.status).toBe(VariableAggregatesStatus.Loading);
    await settle();
    expect(countsOf(second.result.current, "7:a")).toEqual({ x: 2 });
    expect(requests).toHaveLength(2);
  });

  it("reports a question the server couldn't count as unavailable, not zero", async () => {
    answer = async () =>
      json({
        aggregates: [aggregate("a", null), aggregate("b", { x: 0 })],
        answered: [],
      });
    const { result } = render(
      schemaWith([counting("a"), counting("b")]),
      FORM_VERSION,
    );
    await settle();
    expect(result.current.status).toBe(
      VariableAggregatesStatus.SourceUnavailable,
    );
    expect(
      result.current.status === VariableAggregatesStatus.SourceUnavailable && [
        ...result.current.aggregates.keys(),
      ],
    ).toEqual(["7:b"]);
  });

  it("counts nothing for a form with no saved version", async () => {
    const { result } = render(schemaWith([counting("a")]), undefined);
    expect(result.current.status).toBe(
      VariableAggregatesStatus.SourceUnavailable,
    );
    await settle();
    expect(requests).toEqual([]);
  });
});

describe("aggregateTarget", () => {
  it("counts an admin's schema, and otherwise the saved version", () => {
    expect(
      aggregateTarget({ admin: true, formId: 0, formSnapshotId: null }),
    ).toEqual({ reader: AggregateReader.Admin });
    expect(
      aggregateTarget({ admin: false, formId: 3, formSnapshotId: 4 }),
    ).toEqual(FORM_VERSION);
    expect(
      aggregateTarget({ admin: false, formId: 3, formSnapshotId: 0 }),
    ).toBeUndefined();
  });

  it("loads members-who-answered counts with the option counts", async () => {
    answer = async () =>
      json({
        aggregates: [aggregate("a", { x: 2 })],
        answered: [{ sourceFormId: 7, fieldId: "a", count: 5 }],
      });
    const { result } = render(schemaWith([counting("a"), answering("a")]), {
      reader: AggregateReader.Admin,
    });
    await settle();
    expect(requests).toEqual([
      {
        sources: [{ sourceFormId: 7, fieldId: "a" }],
        answeredSources: [{ sourceFormId: 7, fieldId: "a" }],
      },
    ]);
    expect(countsOf(result.current, "7:a")).toEqual({ x: 2 });
    expect(countsOf(result.current, "answered:7:a")).toBe(5);
  });

  it("reports a members-who-answered question the server couldn't count as unavailable", async () => {
    answer = async () =>
      json({
        aggregates: [],
        answered: [{ sourceFormId: 7, fieldId: "a", count: null }],
      });
    const { result } = render(schemaWith([answering("a")]), FORM_VERSION);
    await settle();
    expect(result.current.status).toBe(
      VariableAggregatesStatus.SourceUnavailable,
    );
  });
});
