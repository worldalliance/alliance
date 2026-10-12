import type { CohortExpression } from "@alliance/common/cohort-expression";
import { pending, type Pending } from "@alliance/shared/lib/testing/pending";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { useCohortEvaluationAdmin } from "./useCohortEvaluationAdmin";

afterEach(cleanup);

const allMembers: CohortExpression = { type: "AllMembers" };
const staff: CohortExpression = { type: "Staff" };

const matches: Record<string, number[]> = { AllMembers: [1, 2, 3], Staff: [2] };

let status = 200;
let evaluated: string[] = [];
let holdStaff = false;
let heldStaff: Pending<void>[] = [];

serveApi(
  routes({
    "POST /actions/evaluate-cohort": async ({ request }) => {
      const { expression } = await request.json();
      evaluated.push(expression.type);
      if (expression.type === "Staff" && holdStaff) await pending(heldStaff);
      return status === 200
        ? Response.json({ userIds: matches[expression.type] })
        : Response.json({}, { status });
    },
  }),
);

beforeEach(() => {
  status = 200;
  evaluated = [];
  holdStaff = false;
  heldStaff = [];
});

const renderEvaluation = (
  expression: CohortExpression | null,
  query = queryWrapper(),
) =>
  renderHook(({ expr }) => useCohortEvaluationAdmin(expr), {
    ...query,
    initialProps: { expr: expression },
  });

describe("useCohortEvaluationAdmin", () => {
  it("matches no one and asks nothing without an expression", () => {
    const view = renderEvaluation(null);

    expect([...view.result.current.userIds]).toEqual([]);
    expect(view.result.current.evaluating).toBe(false);
    expect(evaluated).toEqual([]);
  });

  it("loads the ids the expression matches", async () => {
    const view = renderEvaluation(allMembers);

    expect(view.result.current.evaluating).toBe(true);
    await waitFor(() =>
      expect([...view.result.current.userIds]).toEqual([1, 2, 3]),
    );
    expect(view.result.current.evaluating).toBe(false);
  });

  it("evaluates an equal expression once across hooks", async () => {
    const query = queryWrapper();
    const first = renderEvaluation(allMembers, query);
    await waitFor(() => expect(first.result.current.evaluating).toBe(false));

    const second = renderEvaluation({ type: "AllMembers" }, query);

    expect([...second.result.current.userIds]).toEqual([1, 2, 3]);
    expect(query.client.isFetching()).toBe(0);
    expect(evaluated).toEqual(["AllMembers"]);
  });

  it("keeps the previous ids while a changed expression evaluates", async () => {
    holdStaff = true;
    const view = renderEvaluation(allMembers);
    await waitFor(() => expect(view.result.current.evaluating).toBe(false));

    view.rerender({ expr: staff });

    await waitFor(() => expect(heldStaff).toHaveLength(1));
    expect([...view.result.current.userIds]).toEqual([1, 2, 3]);
    expect(view.result.current.evaluating).toBe(true);
    heldStaff[0].resolve();
    await waitFor(() => expect([...view.result.current.userIds]).toEqual([2]));
    expect(view.result.current.evaluating).toBe(false);
  });

  it("matches no one once the expression is cleared", async () => {
    const view = renderEvaluation(allMembers);
    await waitFor(() => expect(view.result.current.evaluating).toBe(false));

    view.rerender({ expr: null });

    expect([...view.result.current.userIds]).toEqual([]);
    expect(view.result.current.evaluating).toBe(false);
  });

  it("matches no one while an expression set after a clear evaluates", async () => {
    holdStaff = true;
    const view = renderEvaluation(allMembers);
    await waitFor(() => expect(view.result.current.evaluating).toBe(false));
    view.rerender({ expr: null });

    view.rerender({ expr: staff });

    await waitFor(() => expect(heldStaff).toHaveLength(1));
    expect([...view.result.current.userIds]).toEqual([]);
    expect(view.result.current.evaluating).toBe(true);
  });

  it("fails the evaluation when the server refuses it", async () => {
    status = 500;
    const view = renderEvaluation(allMembers);

    await waitFor(() => expect(view.result.current.error).not.toBeNull());
    expect([...view.result.current.userIds]).toEqual([]);
    expect(view.result.current.evaluating).toBe(false);
  });
});
