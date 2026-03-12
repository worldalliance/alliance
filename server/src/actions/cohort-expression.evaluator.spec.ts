import {
  evaluateCohortExpression,
  evaluateCohortExpressionForUser,
  CohortEvaluationContext,
  SingleUserCohortContext,
} from './cohort-expression.evaluator';
import {
  CohortExpression,
  expressionReferencesTag,
  isLeafCondition,
  isBooleanOperator,
} from './cohort-expression.types';

// --- Helpers ---

function mockBatchContext(
  overrides: Partial<CohortEvaluationContext> = {},
): CohortEvaluationContext {
  return {
    getUserIdsForTag: jest.fn().mockResolvedValue(new Set<number>()),
    getUserIdsCompletedAction: jest.fn().mockResolvedValue(new Set<number>()),
    getUserIdsInProgressAction: jest.fn().mockResolvedValue(new Set<number>()),
    getUserIdsForFormField: jest.fn().mockResolvedValue(new Set<number>()),
    getGroupLeadUserIds: jest.fn().mockResolvedValue(new Set<number>()),
    getAllCandidateUserIds: jest.fn().mockResolvedValue(new Set<number>()),
    ...overrides,
  };
}

function mockSingleUserContext(
  userId: number,
  overrides: Partial<Omit<SingleUserCohortContext, 'userId'>> = {},
): SingleUserCohortContext {
  return {
    userId,
    userHasTag: jest.fn().mockReturnValue(false),
    userCompletedAction: jest.fn().mockResolvedValue(false),
    userInProgressAction: jest.fn().mockResolvedValue(false),
    userMatchesFormField: jest.fn().mockResolvedValue(false),
    userIsGroupLead: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

// --- Type guards ---

describe('type guards', () => {
  it('isLeafCondition returns true for leaf nodes', () => {
    expect(isLeafCondition({ type: 'Tag', tagId: 'abc' })).toBe(true);
    expect(isLeafCondition({ type: 'Manual', userIds: [1] })).toBe(true);
    expect(isLeafCondition({ type: 'CompletedAction', actionId: 1 })).toBe(
      true,
    );
    expect(isLeafCondition({ type: 'InProgressAction', actionId: 1 })).toBe(
      true,
    );
    expect(
      isLeafCondition({
        type: 'FormFieldValue',
        formId: 1,
        fieldId: 'f1',
      }),
    ).toBe(true);
    expect(isLeafCondition({ type: 'GroupLead' })).toBe(true);
  });

  it('isLeafCondition returns false for operators', () => {
    expect(isLeafCondition({ op: 'AND', children: [] })).toBe(false);
    expect(isLeafCondition({ op: 'OR', children: [] })).toBe(false);
    expect(
      isLeafCondition({ op: 'NOT', child: { type: 'GroupLead' } }),
    ).toBe(false);
  });

  it('isBooleanOperator returns true for operators', () => {
    expect(isBooleanOperator({ op: 'AND', children: [] })).toBe(true);
    expect(isBooleanOperator({ op: 'OR', children: [] })).toBe(true);
    expect(
      isBooleanOperator({ op: 'NOT', child: { type: 'GroupLead' } }),
    ).toBe(true);
  });

  it('isBooleanOperator returns false for leaf nodes', () => {
    expect(isBooleanOperator({ type: 'Tag', tagId: 'abc' })).toBe(false);
  });
});

// --- expressionReferencesTag ---

describe('expressionReferencesTag', () => {
  it('returns false for null/undefined', () => {
    expect(expressionReferencesTag(null, 'tag1')).toBe(false);
    expect(expressionReferencesTag(undefined, 'tag1')).toBe(false);
  });

  it('returns true for matching Tag leaf', () => {
    expect(
      expressionReferencesTag({ type: 'Tag', tagId: 'tag1' }, 'tag1'),
    ).toBe(true);
  });

  it('returns false for non-matching Tag leaf', () => {
    expect(
      expressionReferencesTag({ type: 'Tag', tagId: 'tag2' }, 'tag1'),
    ).toBe(false);
  });

  it('returns false for non-Tag leaf nodes', () => {
    expect(
      expressionReferencesTag({ type: 'Manual', userIds: [1] }, 'tag1'),
    ).toBe(false);
    expect(
      expressionReferencesTag({ type: 'GroupLead' }, 'tag1'),
    ).toBe(false);
  });

  it('finds tag inside AND operator', () => {
    expect(
      expressionReferencesTag(
        {
          op: 'AND',
          children: [
            { type: 'Manual', userIds: [1] },
            { type: 'Tag', tagId: 'tag1' },
          ],
        },
        'tag1',
      ),
    ).toBe(true);
  });

  it('finds tag inside OR operator', () => {
    expect(
      expressionReferencesTag(
        {
          op: 'OR',
          children: [
            { type: 'Tag', tagId: 'tag1' },
            { type: 'Tag', tagId: 'tag2' },
          ],
        },
        'tag2',
      ),
    ).toBe(true);
  });

  it('finds tag inside NOT operator', () => {
    expect(
      expressionReferencesTag(
        { op: 'NOT', child: { type: 'Tag', tagId: 'tag1' } },
        'tag1',
      ),
    ).toBe(true);
  });

  it('finds tag in deeply nested expression', () => {
    const expr: CohortExpression = {
      op: 'AND',
      children: [
        { type: 'GroupLead' },
        {
          op: 'OR',
          children: [
            { type: 'Manual', userIds: [1] },
            {
              op: 'NOT',
              child: { type: 'Tag', tagId: 'deep-tag' },
            },
          ],
        },
      ],
    };
    expect(expressionReferencesTag(expr, 'deep-tag')).toBe(true);
    expect(expressionReferencesTag(expr, 'missing-tag')).toBe(false);
  });

  it('returns false when empty AND has no children', () => {
    expect(
      expressionReferencesTag({ op: 'AND', children: [] }, 'tag1'),
    ).toBe(false);
  });
});

// --- Batch evaluator: evaluateCohortExpression ---

describe('evaluateCohortExpression (batch)', () => {
  describe('leaf conditions', () => {
    it('evaluates Tag condition', async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set([1, 2, 3])),
      });
      const result = await evaluateCohortExpression(
        { type: 'Tag', tagId: 'abc' },
        ctx,
      );
      expect(result).toEqual(new Set([1, 2, 3]));
      expect(ctx.getUserIdsForTag).toHaveBeenCalledWith('abc');
    });

    it('evaluates Manual condition', async () => {
      const ctx = mockBatchContext();
      const result = await evaluateCohortExpression(
        { type: 'Manual', userIds: [10, 20, 30] },
        ctx,
      );
      expect(result).toEqual(new Set([10, 20, 30]));
    });

    it('evaluates Manual condition with empty userIds', async () => {
      const ctx = mockBatchContext();
      const result = await evaluateCohortExpression(
        { type: 'Manual', userIds: [] },
        ctx,
      );
      expect(result).toEqual(new Set());
    });

    it('evaluates CompletedAction condition', async () => {
      const ctx = mockBatchContext({
        getUserIdsCompletedAction: jest
          .fn()
          .mockResolvedValue(new Set([5, 6])),
      });
      const result = await evaluateCohortExpression(
        { type: 'CompletedAction', actionId: 42 },
        ctx,
      );
      expect(result).toEqual(new Set([5, 6]));
      expect(ctx.getUserIdsCompletedAction).toHaveBeenCalledWith(42);
    });

    it('evaluates InProgressAction condition', async () => {
      const ctx = mockBatchContext({
        getUserIdsInProgressAction: jest
          .fn()
          .mockResolvedValue(new Set([7, 8, 9])),
      });
      const result = await evaluateCohortExpression(
        { type: 'InProgressAction', actionId: 99 },
        ctx,
      );
      expect(result).toEqual(new Set([7, 8, 9]));
      expect(ctx.getUserIdsInProgressAction).toHaveBeenCalledWith(99);
    });

    it('evaluates FormFieldValue condition', async () => {
      const ctx = mockBatchContext({
        getUserIdsForFormField: jest
          .fn()
          .mockResolvedValue(new Set([11, 12])),
      });
      const result = await evaluateCohortExpression(
        {
          type: 'FormFieldValue',
          formId: 5,
          fieldId: 'field-1',
          responseEqualTo: 'yes',
        },
        ctx,
      );
      expect(result).toEqual(new Set([11, 12]));
      expect(ctx.getUserIdsForFormField).toHaveBeenCalledWith({
        formId: 5,
        fieldId: 'field-1',
        responseEqualTo: 'yes',
        responseAny: undefined,
      });
    });

    it('evaluates FormFieldValue with responseAny', async () => {
      const ctx = mockBatchContext({
        getUserIdsForFormField: jest.fn().mockResolvedValue(new Set([1])),
      });
      await evaluateCohortExpression(
        {
          type: 'FormFieldValue',
          formId: 5,
          fieldId: 'f1',
          responseAny: true,
        },
        ctx,
      );
      expect(ctx.getUserIdsForFormField).toHaveBeenCalledWith({
        formId: 5,
        fieldId: 'f1',
        responseEqualTo: undefined,
        responseAny: true,
      });
    });

    it('evaluates GroupLead condition', async () => {
      const ctx = mockBatchContext({
        getGroupLeadUserIds: jest.fn().mockResolvedValue(new Set([100, 200])),
      });
      const result = await evaluateCohortExpression(
        { type: 'GroupLead' },
        ctx,
      );
      expect(result).toEqual(new Set([100, 200]));
    });
  });

  describe('AND operator', () => {
    it('returns empty set for empty children', async () => {
      const ctx = mockBatchContext();
      const result = await evaluateCohortExpression(
        { op: 'AND', children: [] },
        ctx,
      );
      expect(result).toEqual(new Set());
    });

    it('intersects two sets', async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest
          .fn()
          .mockResolvedValueOnce(new Set([1, 2, 3, 4]))
          .mockResolvedValueOnce(new Set([2, 3, 5])),
      });
      const result = await evaluateCohortExpression(
        {
          op: 'AND',
          children: [
            { type: 'Tag', tagId: 'a' },
            { type: 'Tag', tagId: 'b' },
          ],
        },
        ctx,
      );
      expect(result).toEqual(new Set([2, 3]));
    });

    it('intersects three sets', async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest
          .fn()
          .mockResolvedValueOnce(new Set([1, 2, 3]))
          .mockResolvedValueOnce(new Set([2, 3, 4]))
          .mockResolvedValueOnce(new Set([3, 4, 5])),
      });
      const result = await evaluateCohortExpression(
        {
          op: 'AND',
          children: [
            { type: 'Tag', tagId: 'a' },
            { type: 'Tag', tagId: 'b' },
            { type: 'Tag', tagId: 'c' },
          ],
        },
        ctx,
      );
      expect(result).toEqual(new Set([3]));
    });

    it('returns empty set when intersection is empty', async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest
          .fn()
          .mockResolvedValueOnce(new Set([1, 2]))
          .mockResolvedValueOnce(new Set([3, 4])),
      });
      const result = await evaluateCohortExpression(
        {
          op: 'AND',
          children: [
            { type: 'Tag', tagId: 'a' },
            { type: 'Tag', tagId: 'b' },
          ],
        },
        ctx,
      );
      expect(result).toEqual(new Set());
    });

    it('works with single child', async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set([1, 2])),
      });
      const result = await evaluateCohortExpression(
        {
          op: 'AND',
          children: [{ type: 'Tag', tagId: 'a' }],
        },
        ctx,
      );
      expect(result).toEqual(new Set([1, 2]));
    });
  });

  describe('OR operator', () => {
    it('returns empty set for empty children', async () => {
      const ctx = mockBatchContext();
      const result = await evaluateCohortExpression(
        { op: 'OR', children: [] },
        ctx,
      );
      expect(result).toEqual(new Set());
    });

    it('unions two sets', async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest
          .fn()
          .mockResolvedValueOnce(new Set([1, 2]))
          .mockResolvedValueOnce(new Set([2, 3])),
      });
      const result = await evaluateCohortExpression(
        {
          op: 'OR',
          children: [
            { type: 'Tag', tagId: 'a' },
            { type: 'Tag', tagId: 'b' },
          ],
        },
        ctx,
      );
      expect(result).toEqual(new Set([1, 2, 3]));
    });

    it('handles disjoint sets', async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest
          .fn()
          .mockResolvedValueOnce(new Set([1, 2]))
          .mockResolvedValueOnce(new Set([3, 4])),
      });
      const result = await evaluateCohortExpression(
        {
          op: 'OR',
          children: [
            { type: 'Tag', tagId: 'a' },
            { type: 'Tag', tagId: 'b' },
          ],
        },
        ctx,
      );
      expect(result).toEqual(new Set([1, 2, 3, 4]));
    });
  });

  describe('NOT operator', () => {
    it('excludes matching users from universe', async () => {
      const ctx = mockBatchContext({
        getAllCandidateUserIds: jest
          .fn()
          .mockResolvedValue(new Set([1, 2, 3, 4, 5])),
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set([2, 4])),
      });
      const result = await evaluateCohortExpression(
        {
          op: 'NOT',
          child: { type: 'Tag', tagId: 'exclude-tag' },
        },
        ctx,
      );
      expect(result).toEqual(new Set([1, 3, 5]));
    });

    it('returns full universe when child matches nobody', async () => {
      const ctx = mockBatchContext({
        getAllCandidateUserIds: jest
          .fn()
          .mockResolvedValue(new Set([1, 2, 3])),
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set()),
      });
      const result = await evaluateCohortExpression(
        {
          op: 'NOT',
          child: { type: 'Tag', tagId: 'empty-tag' },
        },
        ctx,
      );
      expect(result).toEqual(new Set([1, 2, 3]));
    });

    it('returns empty set when child matches everyone', async () => {
      const ctx = mockBatchContext({
        getAllCandidateUserIds: jest
          .fn()
          .mockResolvedValue(new Set([1, 2])),
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set([1, 2])),
      });
      const result = await evaluateCohortExpression(
        {
          op: 'NOT',
          child: { type: 'Tag', tagId: 'all-tag' },
        },
        ctx,
      );
      expect(result).toEqual(new Set());
    });
  });

  describe('nested expressions', () => {
    it('evaluates AND(Tag, NOT(Manual))', async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set([1, 2, 3, 4])),
        getAllCandidateUserIds: jest
          .fn()
          .mockResolvedValue(new Set([1, 2, 3, 4, 5])),
      });
      // AND(tag=a, NOT(Manual[2,4]))
      const result = await evaluateCohortExpression(
        {
          op: 'AND',
          children: [
            { type: 'Tag', tagId: 'a' },
            {
              op: 'NOT',
              child: { type: 'Manual', userIds: [2, 4] },
            },
          ],
        },
        ctx,
      );
      // Tag a = {1,2,3,4}, NOT(Manual[2,4]) = {1,3,5}
      // AND = {1,3}
      expect(result).toEqual(new Set([1, 3]));
    });

    it('evaluates OR(AND(Tag,GroupLead), Manual)', async () => {
      const ctx = mockBatchContext({
        getUserIdsForTag: jest.fn().mockResolvedValue(new Set([1, 2, 3])),
        getGroupLeadUserIds: jest.fn().mockResolvedValue(new Set([2, 5])),
      });
      const result = await evaluateCohortExpression(
        {
          op: 'OR',
          children: [
            {
              op: 'AND',
              children: [
                { type: 'Tag', tagId: 'a' },
                { type: 'GroupLead' },
              ],
            },
            { type: 'Manual', userIds: [10] },
          ],
        },
        ctx,
      );
      // AND(Tag[1,2,3], GroupLead[2,5]) = {2}
      // OR({2}, Manual{10}) = {2, 10}
      expect(result).toEqual(new Set([2, 10]));
    });
  });

  describe('cycle detection', () => {
    it('returns empty set for InProgressAction when actionId is in visited set', async () => {
      const ctx = mockBatchContext({
        getUserIdsInProgressAction: jest
          .fn()
          .mockResolvedValue(new Set([1, 2])),
      });
      const result = await evaluateCohortExpression(
        { type: 'InProgressAction', actionId: 42 },
        ctx,
        new Set([42]),
      );
      expect(result).toEqual(new Set());
      expect(ctx.getUserIdsInProgressAction).not.toHaveBeenCalled();
    });

    it('proceeds normally when actionId is not in visited set', async () => {
      const ctx = mockBatchContext({
        getUserIdsInProgressAction: jest
          .fn()
          .mockResolvedValue(new Set([1, 2])),
      });
      const result = await evaluateCohortExpression(
        { type: 'InProgressAction', actionId: 42 },
        ctx,
        new Set([99]),
      );
      expect(result).toEqual(new Set([1, 2]));
      expect(ctx.getUserIdsInProgressAction).toHaveBeenCalledWith(42);
    });
  });
});

// --- Single-user evaluator: evaluateCohortExpressionForUser ---

describe('evaluateCohortExpressionForUser (single-user)', () => {
  describe('leaf conditions', () => {
    it('evaluates Tag condition - user has tag', async () => {
      const ctx = mockSingleUserContext(1, {
        userHasTag: jest.fn().mockReturnValue(true),
      });
      const result = await evaluateCohortExpressionForUser(
        { type: 'Tag', tagId: 'abc' },
        ctx,
      );
      expect(result).toBe(true);
      expect(ctx.userHasTag).toHaveBeenCalledWith('abc');
    });

    it('evaluates Tag condition - user missing tag', async () => {
      const ctx = mockSingleUserContext(1, {
        userHasTag: jest.fn().mockReturnValue(false),
      });
      const result = await evaluateCohortExpressionForUser(
        { type: 'Tag', tagId: 'abc' },
        ctx,
      );
      expect(result).toBe(false);
    });

    it('evaluates Manual condition - user in list', async () => {
      const ctx = mockSingleUserContext(5);
      const result = await evaluateCohortExpressionForUser(
        { type: 'Manual', userIds: [3, 5, 7] },
        ctx,
      );
      expect(result).toBe(true);
    });

    it('evaluates Manual condition - user not in list', async () => {
      const ctx = mockSingleUserContext(5);
      const result = await evaluateCohortExpressionForUser(
        { type: 'Manual', userIds: [3, 7] },
        ctx,
      );
      expect(result).toBe(false);
    });

    it('evaluates Manual condition - empty list', async () => {
      const ctx = mockSingleUserContext(5);
      const result = await evaluateCohortExpressionForUser(
        { type: 'Manual', userIds: [] },
        ctx,
      );
      expect(result).toBe(false);
    });

    it('evaluates CompletedAction condition', async () => {
      const ctx = mockSingleUserContext(1, {
        userCompletedAction: jest.fn().mockResolvedValue(true),
      });
      const result = await evaluateCohortExpressionForUser(
        { type: 'CompletedAction', actionId: 42 },
        ctx,
      );
      expect(result).toBe(true);
      expect(ctx.userCompletedAction).toHaveBeenCalledWith(42);
    });

    it('evaluates InProgressAction condition', async () => {
      const ctx = mockSingleUserContext(1, {
        userInProgressAction: jest.fn().mockResolvedValue(true),
      });
      const result = await evaluateCohortExpressionForUser(
        { type: 'InProgressAction', actionId: 99 },
        ctx,
      );
      expect(result).toBe(true);
      expect(ctx.userInProgressAction).toHaveBeenCalledWith(99);
    });

    it('evaluates FormFieldValue condition', async () => {
      const ctx = mockSingleUserContext(1, {
        userMatchesFormField: jest.fn().mockResolvedValue(true),
      });
      const result = await evaluateCohortExpressionForUser(
        {
          type: 'FormFieldValue',
          formId: 5,
          fieldId: 'f1',
          responseEqualTo: 'yes',
        },
        ctx,
      );
      expect(result).toBe(true);
      expect(ctx.userMatchesFormField).toHaveBeenCalledWith({
        formId: 5,
        fieldId: 'f1',
        responseEqualTo: 'yes',
        responseAny: undefined,
      });
    });

    it('evaluates GroupLead condition', async () => {
      const ctx = mockSingleUserContext(1, {
        userIsGroupLead: jest.fn().mockResolvedValue(true),
      });
      const result = await evaluateCohortExpressionForUser(
        { type: 'GroupLead' },
        ctx,
      );
      expect(result).toBe(true);
    });
  });

  describe('AND operator', () => {
    it('returns false for empty children', async () => {
      const ctx = mockSingleUserContext(1);
      const result = await evaluateCohortExpressionForUser(
        { op: 'AND', children: [] },
        ctx,
      );
      expect(result).toBe(false);
    });

    it('returns true when all children match', async () => {
      const ctx = mockSingleUserContext(1, {
        userHasTag: jest.fn().mockReturnValue(true),
        userIsGroupLead: jest.fn().mockResolvedValue(true),
      });
      const result = await evaluateCohortExpressionForUser(
        {
          op: 'AND',
          children: [
            { type: 'Tag', tagId: 'a' },
            { type: 'GroupLead' },
          ],
        },
        ctx,
      );
      expect(result).toBe(true);
    });

    it('returns false when any child does not match', async () => {
      const ctx = mockSingleUserContext(1, {
        userHasTag: jest.fn().mockReturnValue(true),
        userIsGroupLead: jest.fn().mockResolvedValue(false),
      });
      const result = await evaluateCohortExpressionForUser(
        {
          op: 'AND',
          children: [
            { type: 'Tag', tagId: 'a' },
            { type: 'GroupLead' },
          ],
        },
        ctx,
      );
      expect(result).toBe(false);
    });

    it('short-circuits on first false', async () => {
      const userIsGroupLead = jest.fn().mockResolvedValue(false);
      const ctx = mockSingleUserContext(1, {
        userHasTag: jest.fn().mockReturnValue(false),
        userIsGroupLead,
      });
      await evaluateCohortExpressionForUser(
        {
          op: 'AND',
          children: [
            { type: 'Tag', tagId: 'a' },
            { type: 'GroupLead' },
          ],
        },
        ctx,
      );
      // GroupLead should not be checked because Tag already returned false
      expect(userIsGroupLead).not.toHaveBeenCalled();
    });
  });

  describe('OR operator', () => {
    it('returns false for empty children', async () => {
      const ctx = mockSingleUserContext(1);
      const result = await evaluateCohortExpressionForUser(
        { op: 'OR', children: [] },
        ctx,
      );
      expect(result).toBe(false);
    });

    it('returns true when any child matches', async () => {
      const ctx = mockSingleUserContext(1, {
        userHasTag: jest.fn().mockReturnValue(false),
        userIsGroupLead: jest.fn().mockResolvedValue(true),
      });
      const result = await evaluateCohortExpressionForUser(
        {
          op: 'OR',
          children: [
            { type: 'Tag', tagId: 'a' },
            { type: 'GroupLead' },
          ],
        },
        ctx,
      );
      expect(result).toBe(true);
    });

    it('returns false when no children match', async () => {
      const ctx = mockSingleUserContext(1, {
        userHasTag: jest.fn().mockReturnValue(false),
        userIsGroupLead: jest.fn().mockResolvedValue(false),
      });
      const result = await evaluateCohortExpressionForUser(
        {
          op: 'OR',
          children: [
            { type: 'Tag', tagId: 'a' },
            { type: 'GroupLead' },
          ],
        },
        ctx,
      );
      expect(result).toBe(false);
    });

    it('short-circuits on first true', async () => {
      const userIsGroupLead = jest.fn().mockResolvedValue(true);
      const ctx = mockSingleUserContext(1, {
        userHasTag: jest.fn().mockReturnValue(true),
        userIsGroupLead,
      });
      await evaluateCohortExpressionForUser(
        {
          op: 'OR',
          children: [
            { type: 'Tag', tagId: 'a' },
            { type: 'GroupLead' },
          ],
        },
        ctx,
      );
      expect(userIsGroupLead).not.toHaveBeenCalled();
    });
  });

  describe('NOT operator', () => {
    it('negates a true result', async () => {
      const ctx = mockSingleUserContext(1, {
        userHasTag: jest.fn().mockReturnValue(true),
      });
      const result = await evaluateCohortExpressionForUser(
        {
          op: 'NOT',
          child: { type: 'Tag', tagId: 'a' },
        },
        ctx,
      );
      expect(result).toBe(false);
    });

    it('negates a false result', async () => {
      const ctx = mockSingleUserContext(1, {
        userHasTag: jest.fn().mockReturnValue(false),
      });
      const result = await evaluateCohortExpressionForUser(
        {
          op: 'NOT',
          child: { type: 'Tag', tagId: 'a' },
        },
        ctx,
      );
      expect(result).toBe(true);
    });
  });

  describe('nested expressions', () => {
    it('evaluates AND(Tag, NOT(Manual)) correctly for included user', async () => {
      const ctx = mockSingleUserContext(1, {
        userHasTag: jest.fn().mockReturnValue(true),
      });
      // user 1 has tag 'a' and is NOT in manual list [2, 4]
      const result = await evaluateCohortExpressionForUser(
        {
          op: 'AND',
          children: [
            { type: 'Tag', tagId: 'a' },
            {
              op: 'NOT',
              child: { type: 'Manual', userIds: [2, 4] },
            },
          ],
        },
        ctx,
      );
      expect(result).toBe(true);
    });

    it('evaluates AND(Tag, NOT(Manual)) correctly for excluded user', async () => {
      const ctx = mockSingleUserContext(2, {
        userHasTag: jest.fn().mockReturnValue(true),
      });
      // user 2 has tag 'a' but IS in manual exclusion list [2, 4]
      const result = await evaluateCohortExpressionForUser(
        {
          op: 'AND',
          children: [
            { type: 'Tag', tagId: 'a' },
            {
              op: 'NOT',
              child: { type: 'Manual', userIds: [2, 4] },
            },
          ],
        },
        ctx,
      );
      expect(result).toBe(false);
    });

    it('evaluates complex: OR(AND(Tag,GroupLead), CompletedAction)', async () => {
      // user is a group lead with the tag, but has NOT completed action 5
      const ctx = mockSingleUserContext(10, {
        userHasTag: jest.fn().mockReturnValue(true),
        userIsGroupLead: jest.fn().mockResolvedValue(true),
        userCompletedAction: jest.fn().mockResolvedValue(false),
      });
      const result = await evaluateCohortExpressionForUser(
        {
          op: 'OR',
          children: [
            {
              op: 'AND',
              children: [
                { type: 'Tag', tagId: 'a' },
                { type: 'GroupLead' },
              ],
            },
            { type: 'CompletedAction', actionId: 5 },
          ],
        },
        ctx,
      );
      // AND(Tag=true, GroupLead=true) = true => OR short-circuits to true
      expect(result).toBe(true);
    });
  });

  describe('cycle detection', () => {
    it('returns false for InProgressAction when actionId is in visited set', async () => {
      const ctx = mockSingleUserContext(1, {
        userInProgressAction: jest.fn().mockResolvedValue(true),
      });
      const result = await evaluateCohortExpressionForUser(
        { type: 'InProgressAction', actionId: 42 },
        ctx,
        new Set([42]),
      );
      expect(result).toBe(false);
      expect(ctx.userInProgressAction).not.toHaveBeenCalled();
    });

    it('proceeds normally when actionId is not in visited set', async () => {
      const ctx = mockSingleUserContext(1, {
        userInProgressAction: jest.fn().mockResolvedValue(true),
      });
      const result = await evaluateCohortExpressionForUser(
        { type: 'InProgressAction', actionId: 42 },
        ctx,
        new Set([99]),
      );
      expect(result).toBe(true);
      expect(ctx.userInProgressAction).toHaveBeenCalledWith(42);
    });
  });
});

// --- Consistency between batch and single-user evaluators ---

describe('batch and single-user evaluator consistency', () => {
  it('both give consistent results for a Tag condition', async () => {
    const tagUsers = new Set([1, 2, 3]);
    const batchCtx = mockBatchContext({
      getUserIdsForTag: jest.fn().mockResolvedValue(tagUsers),
    });

    const batchResult = await evaluateCohortExpression(
      { type: 'Tag', tagId: 'test' },
      batchCtx,
    );

    // Check that each user's single evaluation matches batch membership
    for (const userId of [1, 2, 3, 4, 5]) {
      const singleCtx = mockSingleUserContext(userId, {
        userHasTag: jest
          .fn()
          .mockReturnValue(tagUsers.has(userId)),
      });
      const singleResult = await evaluateCohortExpressionForUser(
        { type: 'Tag', tagId: 'test' },
        singleCtx,
      );
      expect(singleResult).toBe(batchResult.has(userId));
    }
  });

  it('both give consistent results for AND(Tag, Manual)', async () => {
    const tagUsers = new Set([1, 2, 3, 4]);
    const manualUsers = [2, 3, 5];
    const expr: CohortExpression = {
      op: 'AND',
      children: [
        { type: 'Tag', tagId: 'a' },
        { type: 'Manual', userIds: manualUsers },
      ],
    };

    const batchCtx = mockBatchContext({
      getUserIdsForTag: jest.fn().mockResolvedValue(tagUsers),
    });

    const batchResult = await evaluateCohortExpression(expr, batchCtx);
    // AND({1,2,3,4}, {2,3,5}) = {2,3}
    expect(batchResult).toEqual(new Set([2, 3]));

    for (const userId of [1, 2, 3, 4, 5]) {
      const singleCtx = mockSingleUserContext(userId, {
        userHasTag: jest.fn().mockReturnValue(tagUsers.has(userId)),
      });
      const singleResult = await evaluateCohortExpressionForUser(
        expr,
        singleCtx,
      );
      expect(singleResult).toBe(batchResult.has(userId));
    }
  });
});
