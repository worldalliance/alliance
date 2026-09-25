import {
  checkPrerequisites,
  type PrerequisiteNode,
} from "./prerequisite-validation";

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

const node = (
  id: number,
  overrides: Partial<PrerequisiteNode> = {},
): PrerequisiteNode => ({
  id,
  name: `Action ${id}`,
  prerequisiteActionIds: [],
  deadline: day(id),
  ...overrides,
});

const check = (nodes: PrerequisiteNode[], changedIds: number[]) =>
  checkPrerequisites({
    actions: new Map(nodes.map((n) => [n.id, n])),
    changedIds,
  });

describe("checkPrerequisites", () => {
  it("accepts a prerequisite whose deadline comes first", () => {
    expect(
      check([node(1), node(2, { prerequisiteActionIds: [1] })], [2]),
    ).toEqual({ ok: true, value: undefined });
  });

  it("accepts a dependent without a deadline yet", () => {
    expect(
      check(
        [node(1), node(2, { prerequisiteActionIds: [1], deadline: null })],
        [2],
      ).ok,
    ).toBe(true);
  });

  it("rejects a missing prerequisite", () => {
    expect(check([node(2, { prerequisiteActionIds: [1] })], [2])).toEqual({
      ok: false,
      error: '"Action 2" has a prerequisite, #1, that doesn\'t exist.',
    });
  });

  it("rejects a prerequisite without a deadline", () => {
    expect(
      check(
        [node(1, { deadline: null }), node(2, { prerequisiteActionIds: [1] })],
        [1],
      ),
    ).toEqual({
      ok: false,
      error: '"Action 1" needs a deadline to be a prerequisite of "Action 2".',
    });
  });

  it("rejects a prerequisite due at or after its dependent", () => {
    expect(
      check(
        [
          node(1, { deadline: day(2) }),
          node(2, { prerequisiteActionIds: [1] }),
        ],
        [1],
      ),
    ).toEqual({
      ok: false,
      error:
        '"Action 1" is a prerequisite of "Action 2", so its deadline must come first.',
    });
  });

  it("rejects a cycle through the changed action", () => {
    expect(
      check(
        [
          node(1, { prerequisiteActionIds: [3], deadline: null }),
          node(2, { prerequisiteActionIds: [1], deadline: null }),
          node(3, { prerequisiteActionIds: [2], deadline: null }),
        ],
        [1],
      ),
    ).toEqual({
      ok: false,
      error:
        'Prerequisites can\'t loop: "Action 1" → "Action 3" → "Action 2" → "Action 1".',
    });
  });

  it("rejects an action that waits for itself", () => {
    expect(
      check([node(1, { prerequisiteActionIds: [1], deadline: null })], [1]),
    ).toEqual({
      ok: false,
      error: 'Prerequisites can\'t loop: "Action 1" → "Action 1".',
    });
  });

  it("ignores edges that don't touch the changed actions", () => {
    expect(
      check(
        [
          node(1, { deadline: null }),
          node(2, { prerequisiteActionIds: [1] }),
          node(3),
        ],
        [3],
      ).ok,
    ).toBe(true);
  });
});
