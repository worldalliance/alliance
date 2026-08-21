import {
  CohortExpression,
  cohortExpressionSchema,
  expressionReferencesTag,
  isBooleanOperator,
  isLeafCondition,
} from "@alliance/common/cohort-expression";
import {
  answerMatchesFormField,
  CohortEvaluationContext,
  evaluateCohortExpression,
  singleUserCohortContext,
  SingleUserCohortPredicates,
} from "./cohort-expression.evaluator";

// --- Helpers ---

function mockBatchContext(
  overrides: Partial<CohortEvaluationContext> = {},
): CohortEvaluationContext {
  return {
    getUserIdsForTag: jest.fn().mockResolvedValue(new Set<number>()),
    getUserIdsCompletedAction: jest.fn().mockResolvedValue(new Set<number>()),
    getUserIdsInProgressAction: jest.fn().mockResolvedValue(new Set<number>()),
    getUserIdsMissedActionDeadline: jest
      .fn()
      .mockResolvedValue(new Set<number>()),
    getUserIdsForFormField: jest.fn().mockResolvedValue(new Set<number>()),
    getGroupLeadUserIds: jest.fn().mockResolvedValue(new Set<number>()),
    getAllCandidateUserIds: jest.fn().mockResolvedValue(new Set<number>()),
    ...overrides,
  };
}

/**
 * A single-user-scoped context. The single-user case has no separate evaluator:
 * we run the one evaluator with this context and check `.has(userId)`.
 */
function scopedContext(
  userId: number,
  overrides: Partial<Omit<SingleUserCohortPredicates, "userId">> = {},
): CohortEvaluationContext {
  return singleUserCohortContext({
    userId,
    isCandidate: true,
    hasTag: () => false,
    completedAction: async () => false,
    inProgressAction: async () => false,
    missedActionDeadline: async () => false,
    matchesFormField: async () => false,
    isGroupLead: async () => false,
    ...overrides,
  });
}

/** Whether `userId` is in the cohort, via the single unified evaluator. */
async function userInCohort(
  userId: number,
  expr: CohortExpression,
  overrides: Partial<Omit<SingleUserCohortPredicates, "userId">> = {},
  visitedActionIds?: Set<number>,
): Promise<boolean> {
  const ids = await evaluateCohortExpression(
    expr,
    scopedContext(userId, overrides),
    visitedActionIds,
  );
  return ids.has(userId);
}

// --- Type guards ---

describe("type guards", () => {
  it("isLeafCondition returns true for leaf nodes", () => {
    expect(isLeafCondition({ type: "Tag", tagId: "abc" })).toBe(true);
    expect(isLeafCondition({ type: "Manual", userIds: [1] })).toBe(true);
    expect(isLeafCondition({ type: "CompletedAction", actionId: 1 })).toBe(
      true,
    );
    expect(isLeafCondition({ type: "InProgressAction", actionId: 1 })).toBe(
      true,
    );
    expect(isLeafCondition({ type: "MissedActionDeadline", actionId: 1 })).toBe(
      true,
    );
    expect(
      isLeafCondition({
        type: "FormFieldValue",
        formId: 1,
        fieldId: "f1",
      }),
    ).toBe(true);
    expect(isLeafCondition({ type: "GroupLead" })).toBe(true);
  });

  it("isLeafCondition returns false for operators", () => {
    expect(isLeafCondition({ type: "AND", children: [] })).toBe(false);
    expect(isLeafCondition({ type: "OR", children: [] })).toBe(false);
    expect(isLeafCondition({ type: "NOT", child: { type: "GroupLead" } })).toBe(
      false,
    );
  });

  it("isBooleanOperator returns true for operators", () => {
    expect(isBooleanOperator({ type: "AND", children: [] })).toBe(true);
    expect(isBooleanOperator({ type: "OR", children: [] })).toBe(true);
    expect(
      isBooleanOperator({ type: "NOT", child: { type: "GroupLead" } }),
    ).toBe(true);
  });

  it("isBooleanOperator returns false for leaf nodes", () => {
    expect(isBooleanOperator({ type: "Tag", tagId: "abc" })).toBe(false);
  });
});

// --- FormFieldValue schema refinement ---

describe("formFieldValueConditionSchema refinement", () => {
  const base = { type: "FormFieldValue", formId: 1, fieldId: "f1" };

  it("accepts neither responseEqualTo nor responseAny (presence check)", () => {
    expect(cohortExpressionSchema.safeParse(base).success).toBe(true);
  });

  it("accepts responseEqualTo alone", () => {
    expect(
      cohortExpressionSchema.safeParse({ ...base, responseEqualTo: "yes" })
        .success,
    ).toBe(true);
  });

  it("accepts responseAny alone", () => {
    expect(
      cohortExpressionSchema.safeParse({ ...base, responseAny: true }).success,
    ).toBe(true);
  });

  it("accepts responseEqualTo with responseAny explicitly false", () => {
    expect(
      cohortExpressionSchema.safeParse({
        ...base,
        responseEqualTo: "yes",
        responseAny: false,
      }).success,
    ).toBe(true);
  });

  it("rejects responseAny true shadowing responseEqualTo", () => {
    expect(
      cohortExpressionSchema.safeParse({
        ...base,
        responseEqualTo: "yes",
        responseAny: true,
      }).success,
    ).toBe(false);
  });

  it("rejects the shadowing combination nested in an operator", () => {
    expect(
      cohortExpressionSchema.safeParse({
        type: "AND",
        children: [{ ...base, responseEqualTo: "yes", responseAny: true }],
      }).success,
    ).toBe(false);
  });
});

// --- expressionReferencesTag ---

describe("expressionReferencesTag", () => {
  it("returns false for null/undefined", () => {
    expect(expressionReferencesTag(null, "tag1")).toBe(false);
    expect(expressionReferencesTag(undefined, "tag1")).toBe(false);
  });

  it("returns true for matching Tag leaf", () => {
    expect(
      expressionReferencesTag({ type: "Tag", tagId: "tag1" }, "tag1"),
    ).toBe(true);
  });

  it("returns false for non-matching Tag leaf", () => {
    expect(
      expressionReferencesTag({ type: "Tag", tagId: "tag2" }, "tag1"),
    ).toBe(false);
  });

  it("returns false for non-Tag leaf nodes", () => {
    expect(
      expressionReferencesTag({ type: "Manual", userIds: [1] }, "tag1"),
    ).toBe(false);
    expect(expressionReferencesTag({ type: "GroupLead" }, "tag1")).toBe(false);
  });

  it("finds tag inside AND operator", () => {
    expect(
      expressionReferencesTag(
        {
          type: "AND",
          children: [
            { type: "Manual", userIds: [1] },
            { type: "Tag", tagId: "tag1" },
          ],
        },
        "tag1",
      ),
    ).toBe(true);
  });

  it("finds tag inside OR operator", () => {
    expect(
      expressionReferencesTag(
        {
          type: "OR",
          children: [
            { type: "Tag", tagId: "tag1" },
            { type: "Tag", tagId: "tag2" },
          ],
        },
        "tag2",
      ),
    ).toBe(true);
  });

  it("finds tag inside NOT operator", () => {
    expect(
      expressionReferencesTag(
        { type: "NOT", child: { type: "Tag", tagId: "tag1" } },
        "tag1",
      ),
    ).toBe(true);
  });

  it("finds tag in deeply nested expression", () => {
    const expr: CohortExpression = {
      type: "AND",
      children: [
        { type: "GroupLead" },
        {
          type: "OR",
          children: [
            { type: "Manual", userIds: [1] },
            {
              type: "NOT",
              child: { type: "Tag", tagId: "deep-tag" },
            },
          ],
        },
      ],
    };
    expect(expressionReferencesTag(expr, "deep-tag")).toBe(true);
    expect(expressionReferencesTag(expr, "missing-tag")).toBe(false);
  });

  it("returns false when empty AND has no children", () => {
    expect(expressionReferencesTag({ type: "AND", children: [] }, "tag1")).toBe(
      false,
    );
  });
});

// --- The evaluator: population (set) results ---

describe("evaluateCohortExpression", () => {
  describe("leaf conditions", () => {
    it("evaluates Tag condition", async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set([1, 2, 3])),
      });
      const result = await evaluateCohortExpression(
        { type: "Tag", tagId: "abc" },
        ctx,
      );
      expect(result).toEqual(new Set([1, 2, 3]));
      expect(ctx.getUserIdsForTag).toHaveBeenCalledWith("abc");
    });

    it("evaluates Manual condition", async () => {
      const ctx = mockBatchContext();
      const result = await evaluateCohortExpression(
        { type: "Manual", userIds: [10, 20, 30] },
        ctx,
      );
      expect(result).toEqual(new Set([10, 20, 30]));
    });

    it("evaluates Manual condition with empty userIds", async () => {
      const ctx = mockBatchContext();
      const result = await evaluateCohortExpression(
        { type: "Manual", userIds: [] },
        ctx,
      );
      expect(result).toEqual(new Set());
    });

    it("evaluates CompletedAction condition", async () => {
      const ctx = mockBatchContext({
        getUserIdsCompletedAction: jest.fn().mockResolvedValue(new Set([5, 6])),
      });
      const result = await evaluateCohortExpression(
        { type: "CompletedAction", actionId: 42 },
        ctx,
      );
      expect(result).toEqual(new Set([5, 6]));
      expect(ctx.getUserIdsCompletedAction).toHaveBeenCalledWith(42);
    });

    it("evaluates InProgressAction condition", async () => {
      const ctx = mockBatchContext({
        getUserIdsInProgressAction: jest
          .fn()
          .mockResolvedValue(new Set([7, 8, 9])),
      });
      const result = await evaluateCohortExpression(
        { type: "InProgressAction", actionId: 99 },
        ctx,
      );
      expect(result).toEqual(new Set([7, 8, 9]));
      expect(ctx.getUserIdsInProgressAction).toHaveBeenCalledWith(99);
    });

    it("evaluates MissedActionDeadline condition", async () => {
      const ctx = mockBatchContext({
        getUserIdsMissedActionDeadline: jest
          .fn()
          .mockResolvedValue(new Set([4, 5])),
      });
      const result = await evaluateCohortExpression(
        { type: "MissedActionDeadline", actionId: 77 },
        ctx,
      );
      expect(result).toEqual(new Set([4, 5]));
      expect(ctx.getUserIdsMissedActionDeadline).toHaveBeenCalledWith(77);
    });

    it("evaluates FormFieldValue condition", async () => {
      const ctx = mockBatchContext({
        getUserIdsForFormField: jest.fn().mockResolvedValue(new Set([11, 12])),
      });
      const result = await evaluateCohortExpression(
        {
          type: "FormFieldValue",
          formId: 5,
          fieldId: "field-1",
          responseEqualTo: "yes",
        },
        ctx,
      );
      expect(result).toEqual(new Set([11, 12]));
      expect(ctx.getUserIdsForFormField).toHaveBeenCalledWith({
        formId: 5,
        fieldId: "field-1",
        responseEqualTo: "yes",
        responseAny: undefined,
      });
    });

    it("evaluates FormFieldValue with responseAny", async () => {
      const ctx = mockBatchContext({
        getUserIdsForFormField: jest.fn().mockResolvedValue(new Set([1])),
      });
      await evaluateCohortExpression(
        {
          type: "FormFieldValue",
          formId: 5,
          fieldId: "f1",
          responseAny: true,
        },
        ctx,
      );
      expect(ctx.getUserIdsForFormField).toHaveBeenCalledWith({
        formId: 5,
        fieldId: "f1",
        responseEqualTo: undefined,
        responseAny: true,
      });
    });

    it("evaluates GroupLead condition", async () => {
      const ctx = mockBatchContext({
        getGroupLeadUserIds: jest.fn().mockResolvedValue(new Set([100, 200])),
      });
      const result = await evaluateCohortExpression({ type: "GroupLead" }, ctx);
      expect(result).toEqual(new Set([100, 200]));
    });
  });

  describe("AND operator", () => {
    it("returns empty set for empty children", async () => {
      const ctx = mockBatchContext();
      const result = await evaluateCohortExpression(
        { type: "AND", children: [] },
        ctx,
      );
      expect(result).toEqual(new Set());
    });

    it("intersects two sets", async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest
          .fn()
          .mockResolvedValueOnce(new Set([1, 2, 3, 4]))
          .mockResolvedValueOnce(new Set([2, 3, 5])),
      });
      const result = await evaluateCohortExpression(
        {
          type: "AND",
          children: [
            { type: "Tag", tagId: "a" },
            { type: "Tag", tagId: "b" },
          ],
        },
        ctx,
      );
      expect(result).toEqual(new Set([2, 3]));
    });

    it("intersects three sets", async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest
          .fn()
          .mockResolvedValueOnce(new Set([1, 2, 3]))
          .mockResolvedValueOnce(new Set([2, 3, 4]))
          .mockResolvedValueOnce(new Set([3, 4, 5])),
      });
      const result = await evaluateCohortExpression(
        {
          type: "AND",
          children: [
            { type: "Tag", tagId: "a" },
            { type: "Tag", tagId: "b" },
            { type: "Tag", tagId: "c" },
          ],
        },
        ctx,
      );
      expect(result).toEqual(new Set([3]));
    });

    it("returns empty set when intersection is empty", async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest
          .fn()
          .mockResolvedValueOnce(new Set([1, 2]))
          .mockResolvedValueOnce(new Set([3, 4])),
      });
      const result = await evaluateCohortExpression(
        {
          type: "AND",
          children: [
            { type: "Tag", tagId: "a" },
            { type: "Tag", tagId: "b" },
          ],
        },
        ctx,
      );
      expect(result).toEqual(new Set());
    });

    it("works with single child", async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set([1, 2])),
      });
      const result = await evaluateCohortExpression(
        {
          type: "AND",
          children: [{ type: "Tag", tagId: "a" }],
        },
        ctx,
      );
      expect(result).toEqual(new Set([1, 2]));
    });
  });

  describe("OR operator", () => {
    it("returns empty set for empty children", async () => {
      const ctx = mockBatchContext();
      const result = await evaluateCohortExpression(
        { type: "OR", children: [] },
        ctx,
      );
      expect(result).toEqual(new Set());
    });

    it("unions two sets", async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest
          .fn()
          .mockResolvedValueOnce(new Set([1, 2]))
          .mockResolvedValueOnce(new Set([2, 3])),
      });
      const result = await evaluateCohortExpression(
        {
          type: "OR",
          children: [
            { type: "Tag", tagId: "a" },
            { type: "Tag", tagId: "b" },
          ],
        },
        ctx,
      );
      expect(result).toEqual(new Set([1, 2, 3]));
    });

    it("handles disjoint sets", async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest
          .fn()
          .mockResolvedValueOnce(new Set([1, 2]))
          .mockResolvedValueOnce(new Set([3, 4])),
      });
      const result = await evaluateCohortExpression(
        {
          type: "OR",
          children: [
            { type: "Tag", tagId: "a" },
            { type: "Tag", tagId: "b" },
          ],
        },
        ctx,
      );
      expect(result).toEqual(new Set([1, 2, 3, 4]));
    });
  });

  describe("NOT operator", () => {
    it("excludes matching users from universe", async () => {
      const ctx = mockBatchContext({
        getAllCandidateUserIds: jest
          .fn()
          .mockResolvedValue(new Set([1, 2, 3, 4, 5])),
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set([2, 4])),
      });
      const result = await evaluateCohortExpression(
        {
          type: "NOT",
          child: { type: "Tag", tagId: "exclude-tag" },
        },
        ctx,
      );
      expect(result).toEqual(new Set([1, 3, 5]));
    });

    it("returns full universe when child matches nobody", async () => {
      const ctx = mockBatchContext({
        getAllCandidateUserIds: jest.fn().mockResolvedValue(new Set([1, 2, 3])),
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set()),
      });
      const result = await evaluateCohortExpression(
        {
          type: "NOT",
          child: { type: "Tag", tagId: "empty-tag" },
        },
        ctx,
      );
      expect(result).toEqual(new Set([1, 2, 3]));
    });

    it("returns empty set when child matches everyone", async () => {
      const ctx = mockBatchContext({
        getAllCandidateUserIds: jest.fn().mockResolvedValue(new Set([1, 2])),
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set([1, 2])),
      });
      const result = await evaluateCohortExpression(
        {
          type: "NOT",
          child: { type: "Tag", tagId: "all-tag" },
        },
        ctx,
      );
      expect(result).toEqual(new Set());
    });
  });

  describe("nested expressions", () => {
    it("evaluates AND(Tag, NOT(Manual))", async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set([1, 2, 3, 4])),
        getAllCandidateUserIds: jest
          .fn()
          .mockResolvedValue(new Set([1, 2, 3, 4, 5])),
      });
      // AND(tag=a, NOT(Manual[2,4]))
      const result = await evaluateCohortExpression(
        {
          type: "AND",
          children: [
            { type: "Tag", tagId: "a" },
            {
              type: "NOT",
              child: { type: "Manual", userIds: [2, 4] },
            },
          ],
        },
        ctx,
      );
      // Tag a = {1,2,3,4}, NOT(Manual[2,4]) = {1,3,5}
      // AND = {1,3}
      expect(result).toEqual(new Set([1, 3]));
    });

    it("evaluates OR(AND(Tag,GroupLead), Manual)", async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set([1, 2, 3])),
        getGroupLeadUserIds: jest.fn().mockResolvedValue(new Set([2, 5])),
      });
      const result = await evaluateCohortExpression(
        {
          type: "OR",
          children: [
            {
              type: "AND",
              children: [{ type: "Tag", tagId: "a" }, { type: "GroupLead" }],
            },
            { type: "Manual", userIds: [10] },
          ],
        },
        ctx,
      );
      // AND(Tag[1,2,3], GroupLead[2,5]) = {2}
      // OR({2}, Manual{10}) = {2, 10}
      expect(result).toEqual(new Set([2, 10]));
    });
  });

  describe("cycle detection", () => {
    it("returns empty set for InProgressAction when actionId is in visited set", async () => {
      const ctx = mockBatchContext({
        getUserIdsInProgressAction: jest
          .fn()
          .mockResolvedValue(new Set([1, 2])),
      });
      const result = await evaluateCohortExpression(
        { type: "InProgressAction", actionId: 42 },
        ctx,
        new Set([42]),
      );
      expect(result).toEqual(new Set());
      expect(ctx.getUserIdsInProgressAction).not.toHaveBeenCalled();
    });

    it("proceeds normally when actionId is not in visited set", async () => {
      const ctx = mockBatchContext({
        getUserIdsInProgressAction: jest
          .fn()
          .mockResolvedValue(new Set([1, 2])),
      });
      const result = await evaluateCohortExpression(
        { type: "InProgressAction", actionId: 42 },
        ctx,
        new Set([99]),
      );
      expect(result).toEqual(new Set([1, 2]));
      expect(ctx.getUserIdsInProgressAction).toHaveBeenCalledWith(42);
    });

    it("returns empty set for MissedActionDeadline when actionId is in visited set", async () => {
      const ctx = mockBatchContext({
        getUserIdsMissedActionDeadline: jest
          .fn()
          .mockResolvedValue(new Set([1, 2])),
      });
      const result = await evaluateCohortExpression(
        { type: "MissedActionDeadline", actionId: 42 },
        ctx,
        new Set([42]),
      );
      expect(result).toEqual(new Set());
      expect(ctx.getUserIdsMissedActionDeadline).not.toHaveBeenCalled();
    });
  });
});

// --- Single-user scoping via singleUserCohortContext + .has(userId) ---

describe("single-user scoping (singleUserCohortContext)", () => {
  describe("leaf conditions", () => {
    it("evaluates Tag condition - user has tag", async () => {
      const hasTag = jest.fn().mockReturnValue(true);
      const result = await userInCohort(
        1,
        { type: "Tag", tagId: "abc" },
        {
          hasTag,
        },
      );
      expect(result).toBe(true);
      expect(hasTag).toHaveBeenCalledWith("abc");
    });

    it("evaluates Tag condition - user missing tag", async () => {
      const result = await userInCohort(
        1,
        { type: "Tag", tagId: "abc" },
        {
          hasTag: () => false,
        },
      );
      expect(result).toBe(false);
    });

    it("evaluates Manual condition - user in list", async () => {
      const result = await userInCohort(5, {
        type: "Manual",
        userIds: [3, 5, 7],
      });
      expect(result).toBe(true);
    });

    it("evaluates Manual condition - user not in list", async () => {
      const result = await userInCohort(5, {
        type: "Manual",
        userIds: [3, 7],
      });
      expect(result).toBe(false);
    });

    it("evaluates Manual condition - empty list", async () => {
      const result = await userInCohort(5, { type: "Manual", userIds: [] });
      expect(result).toBe(false);
    });

    it("evaluates CompletedAction condition", async () => {
      const completedAction = jest.fn().mockResolvedValue(true);
      const result = await userInCohort(
        1,
        { type: "CompletedAction", actionId: 42 },
        { completedAction },
      );
      expect(result).toBe(true);
      expect(completedAction).toHaveBeenCalledWith(42);
    });

    it("evaluates InProgressAction condition", async () => {
      const inProgressAction = jest.fn().mockResolvedValue(true);
      const result = await userInCohort(
        1,
        { type: "InProgressAction", actionId: 99 },
        { inProgressAction },
      );
      expect(result).toBe(true);
      expect(inProgressAction).toHaveBeenCalledWith(99);
    });

    it("evaluates MissedActionDeadline condition", async () => {
      const missedActionDeadline = jest.fn().mockResolvedValue(true);
      const result = await userInCohort(
        1,
        { type: "MissedActionDeadline", actionId: 77 },
        { missedActionDeadline },
      );
      expect(result).toBe(true);
      expect(missedActionDeadline).toHaveBeenCalledWith(77);
    });

    it("evaluates FormFieldValue condition", async () => {
      const matchesFormField = jest.fn().mockResolvedValue(true);
      const result = await userInCohort(
        1,
        {
          type: "FormFieldValue",
          formId: 5,
          fieldId: "f1",
          responseEqualTo: "yes",
        },
        { matchesFormField },
      );
      expect(result).toBe(true);
      expect(matchesFormField).toHaveBeenCalledWith({
        formId: 5,
        fieldId: "f1",
        responseEqualTo: "yes",
        responseAny: undefined,
      });
    });

    it("evaluates GroupLead condition", async () => {
      const result = await userInCohort(
        1,
        { type: "GroupLead" },
        {
          isGroupLead: async () => true,
        },
      );
      expect(result).toBe(true);
    });
  });

  describe("AND operator", () => {
    it("returns false for empty children", async () => {
      const result = await userInCohort(1, { type: "AND", children: [] });
      expect(result).toBe(false);
    });

    it("returns true when all children match", async () => {
      const result = await userInCohort(
        1,
        {
          type: "AND",
          children: [{ type: "Tag", tagId: "a" }, { type: "GroupLead" }],
        },
        { hasTag: () => true, isGroupLead: async () => true },
      );
      expect(result).toBe(true);
    });

    it("returns false when any child does not match", async () => {
      const result = await userInCohort(
        1,
        {
          type: "AND",
          children: [{ type: "Tag", tagId: "a" }, { type: "GroupLead" }],
        },
        { hasTag: () => true, isGroupLead: async () => false },
      );
      expect(result).toBe(false);
    });

    it("short-circuits on first non-match (skips later predicates)", async () => {
      const isGroupLead = jest.fn().mockResolvedValue(true);
      const result = await userInCohort(
        1,
        {
          type: "AND",
          children: [{ type: "Tag", tagId: "a" }, { type: "GroupLead" }],
        },
        { hasTag: () => false, isGroupLead },
      );
      expect(result).toBe(false);
      // GroupLead should not be checked because Tag already excluded the user.
      expect(isGroupLead).not.toHaveBeenCalled();
    });
  });

  describe("OR operator", () => {
    it("returns false for empty children", async () => {
      const result = await userInCohort(1, { type: "OR", children: [] });
      expect(result).toBe(false);
    });

    it("returns true when any child matches", async () => {
      const result = await userInCohort(
        1,
        {
          type: "OR",
          children: [{ type: "Tag", tagId: "a" }, { type: "GroupLead" }],
        },
        { hasTag: () => false, isGroupLead: async () => true },
      );
      expect(result).toBe(true);
    });

    it("returns false when no children match", async () => {
      const result = await userInCohort(
        1,
        {
          type: "OR",
          children: [{ type: "Tag", tagId: "a" }, { type: "GroupLead" }],
        },
        { hasTag: () => false, isGroupLead: async () => false },
      );
      expect(result).toBe(false);
    });

    it("short-circuits on first match (skips later predicates)", async () => {
      const isGroupLead = jest.fn().mockResolvedValue(true);
      const result = await userInCohort(
        1,
        {
          type: "OR",
          children: [{ type: "Tag", tagId: "a" }, { type: "GroupLead" }],
        },
        { hasTag: () => true, isGroupLead },
      );
      expect(result).toBe(true);
      // GroupLead should not be checked because Tag already matched.
      expect(isGroupLead).not.toHaveBeenCalled();
    });
  });

  describe("NOT operator", () => {
    it("negates a true result", async () => {
      const result = await userInCohort(
        1,
        {
          type: "NOT",
          child: { type: "Tag", tagId: "a" },
        },
        { hasTag: () => true },
      );
      expect(result).toBe(false);
    });

    it("negates a false result for a candidate user", async () => {
      const result = await userInCohort(
        1,
        {
          type: "NOT",
          child: { type: "Tag", tagId: "a" },
        },
        { hasTag: () => false, isCandidate: true },
      );
      expect(result).toBe(true);
    });

    it("excludes a non-candidate user from NOT (matches population NOT-universe)", async () => {
      const result = await userInCohort(
        1,
        {
          type: "NOT",
          child: { type: "Tag", tagId: "a" },
        },
        { hasTag: () => false, isCandidate: false },
      );
      expect(result).toBe(false);
    });
  });

  describe("nested expressions", () => {
    it("evaluates AND(Tag, NOT(Manual)) for included user", async () => {
      // user 1 has tag 'a' and is NOT in manual list [2, 4]
      const result = await userInCohort(
        1,
        {
          type: "AND",
          children: [
            { type: "Tag", tagId: "a" },
            { type: "NOT", child: { type: "Manual", userIds: [2, 4] } },
          ],
        },
        { hasTag: () => true },
      );
      expect(result).toBe(true);
    });

    it("evaluates AND(Tag, NOT(Manual)) for excluded user", async () => {
      // user 2 has tag 'a' but IS in manual exclusion list [2, 4]
      const result = await userInCohort(
        2,
        {
          type: "AND",
          children: [
            { type: "Tag", tagId: "a" },
            { type: "NOT", child: { type: "Manual", userIds: [2, 4] } },
          ],
        },
        { hasTag: () => true },
      );
      expect(result).toBe(false);
    });

    it("evaluates OR(AND(Tag,GroupLead), CompletedAction)", async () => {
      // group lead with the tag, has NOT completed action 5
      const result = await userInCohort(
        10,
        {
          type: "OR",
          children: [
            {
              type: "AND",
              children: [{ type: "Tag", tagId: "a" }, { type: "GroupLead" }],
            },
            { type: "CompletedAction", actionId: 5 },
          ],
        },
        {
          hasTag: () => true,
          isGroupLead: async () => true,
          completedAction: async () => false,
        },
      );
      expect(result).toBe(true);
    });
  });

  describe("cycle detection", () => {
    it("skips InProgressAction when actionId is in visited set", async () => {
      const inProgressAction = jest.fn().mockResolvedValue(true);
      const result = await userInCohort(
        1,
        { type: "InProgressAction", actionId: 42 },
        { inProgressAction },
        new Set([42]),
      );
      expect(result).toBe(false);
      expect(inProgressAction).not.toHaveBeenCalled();
    });

    it("proceeds when actionId is not in visited set", async () => {
      const inProgressAction = jest.fn().mockResolvedValue(true);
      const result = await userInCohort(
        1,
        { type: "InProgressAction", actionId: 42 },
        { inProgressAction },
        new Set([99]),
      );
      expect(result).toBe(true);
      expect(inProgressAction).toHaveBeenCalledWith(42);
    });
  });
});

// --- Population and single-user agree (one evaluator, two contexts) ---

describe("population and single-user agreement", () => {
  it("agree for a Tag condition", async () => {
    const tagUsers = new Set([1, 2, 3]);
    const batchResult = await evaluateCohortExpression(
      { type: "Tag", tagId: "test" },
      mockBatchContext({
        getUserIdsForTag: jest.fn().mockResolvedValue(tagUsers),
      }),
    );

    for (const userId of [1, 2, 3, 4, 5]) {
      const single = await userInCohort(
        userId,
        { type: "Tag", tagId: "test" },
        {
          hasTag: () => tagUsers.has(userId),
        },
      );
      expect(single).toBe(batchResult.has(userId));
    }
  });

  it("agree for AND(Tag, Manual)", async () => {
    const tagUsers = new Set([1, 2, 3, 4]);
    const manualUsers = [2, 3, 5];
    const expr: CohortExpression = {
      type: "AND",
      children: [
        { type: "Tag", tagId: "a" },
        { type: "Manual", userIds: manualUsers },
      ],
    };

    const batchResult = await evaluateCohortExpression(
      expr,
      mockBatchContext({
        getUserIdsForTag: jest.fn().mockResolvedValue(tagUsers),
      }),
    );
    // AND({1,2,3,4}, {2,3,5}) = {2,3}
    expect(batchResult).toEqual(new Set([2, 3]));

    for (const userId of [1, 2, 3, 4, 5]) {
      const single = await userInCohort(userId, expr, {
        hasTag: () => tagUsers.has(userId),
      });
      expect(single).toBe(batchResult.has(userId));
    }
  });

  it("agree for NOT(Tag) including the universe boundary", async () => {
    // Population: universe = candidates {1,2,3,4}; tag = {2,4}; NOT = {1,3}.
    // User 5 is not a candidate, so it must be excluded by both.
    const candidates = new Set([1, 2, 3, 4]);
    const tagUsers = new Set([2, 4]);
    const expr: CohortExpression = {
      type: "NOT",
      child: { type: "Tag", tagId: "a" },
    };

    const batchResult = await evaluateCohortExpression(
      expr,
      mockBatchContext({
        getAllCandidateUserIds: jest.fn().mockResolvedValue(candidates),
        getUserIdsForTag: jest.fn().mockResolvedValue(tagUsers),
      }),
    );
    expect(batchResult).toEqual(new Set([1, 3]));

    for (const userId of [1, 2, 3, 4, 5]) {
      const single = await userInCohort(userId, expr, {
        isCandidate: candidates.has(userId),
        hasTag: () => tagUsers.has(userId),
      });
      expect(single).toBe(batchResult.has(userId));
    }
  });
});

// --- answerMatchesFormField ---

describe("answerMatchesFormField", () => {
  it("matches an exact responseEqualTo value", () => {
    expect(
      answerMatchesFormField(
        { f1: "yes" },
        { fieldId: "f1", responseEqualTo: "yes" },
      ),
    ).toBe(true);
    expect(
      answerMatchesFormField(
        { f1: "no" },
        { fieldId: "f1", responseEqualTo: "yes" },
      ),
    ).toBe(false);
  });

  it("coerces non-string answers when comparing responseEqualTo", () => {
    expect(
      answerMatchesFormField(
        { f1: 5 },
        { fieldId: "f1", responseEqualTo: "5" },
      ),
    ).toBe(true);
  });

  it("treats responseAny as presence (any non-empty answer)", () => {
    expect(
      answerMatchesFormField(
        { f1: "anything" },
        { fieldId: "f1", responseAny: true },
      ),
    ).toBe(true);
    expect(
      answerMatchesFormField({ f1: "" }, { fieldId: "f1", responseAny: true }),
    ).toBe(false);
    expect(
      answerMatchesFormField({ f1: [] }, { fieldId: "f1", responseAny: true }),
    ).toBe(false);
    expect(
      answerMatchesFormField({}, { fieldId: "f1", responseAny: true }),
    ).toBe(false);
  });

  it("responseAny overrides responseEqualTo (presence wins)", () => {
    expect(
      answerMatchesFormField(
        { f1: "something-else" },
        { fieldId: "f1", responseEqualTo: "yes", responseAny: true },
      ),
    ).toBe(true);
  });

  it("returns false for null/undefined answers", () => {
    expect(
      answerMatchesFormField(null, { fieldId: "f1", responseEqualTo: "yes" }),
    ).toBe(false);
    expect(
      answerMatchesFormField(undefined, { fieldId: "f1", responseAny: true }),
    ).toBe(false);
  });
});
