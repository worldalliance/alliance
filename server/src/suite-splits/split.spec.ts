import { TypeKind, type Scope } from "@alliance/common/expression/catalog";
import { parseExpression } from "@alliance/common/expression/parse";
import { R } from "@alliance/common/result";
import { CellAssignment, GroupWork } from "@alliance/common/suite-split";
import { BadRequestException } from "@nestjs/common";
import { catalogWith } from "src/formulas/formula-catalog";
import {
  checkSplit,
  ONLY_LISTS_AND_FORMULAS,
  type GroupDraft,
} from "./split-check";
import {
  EVERYONE_ELSE,
  GroupFallback,
  impliedOptional,
  type SplitGroup,
} from "./split-groups";
import { previewSplit } from "./split-preview";
import { ResolutionKind, resolveGroup, TraceOutcome } from "./split-resolve";

const LIST = { id: "list-a", name: "A" };
const scope: Scope = {
  catalog: catalogWith([LIST]),
  named: [
    {
      id: "f-maybe",
      name: "maybe",
      tree: R.unwrap(
        parseExpression('isOnList("A") ? true : null', {
          catalog: catalogWith([LIST]),
          named: [],
        }),
      ),
    },
  ],
};
const ACTIONS = [1, 2];

const draft = (
  name: string,
  text: string | null,
  overrides: Partial<GroupDraft> = {},
): GroupDraft => ({
  id: `${name}-id`,
  name,
  text,
  fallback: null,
  noRequiredWorkTick: false,
  cells: [],
  ...overrides,
});
const everyoneElse = (overrides: Partial<GroupDraft> = {}) =>
  draft(EVERYONE_ELSE, null, overrides);
const check = (drafts: GroupDraft[]) =>
  checkSplit({ drafts, scope, actionIds: ACTIONS });
const groups = (drafts: GroupDraft[]): SplitGroup[] => {
  const checked = check(drafts);
  if (!checked.ok) throw new Error(JSON.stringify(checked.error));
  return checked.value.groups;
};

describe("checkSplit", () => {
  it("refuses a repeated or empty name", () => {
    const checked = check([
      draft("Here", "true"),
      draft(" here ", "false"),
      draft(" ", "true"),
      everyoneElse(),
    ]);
    expect(checked).toEqual(
      R.failure([
        {
          groupId: " here -id",
          message: 'Another group is already called "here".',
        },
        { groupId: " -id", message: "Name the group in 1 to 100 characters." },
      ]),
    );
  });

  it("refuses a split not ending in Everyone else as a bad request", () => {
    expect(() => check([draft("Here", "true")])).toThrow(BadRequestException);
    expect(() => check([draft("Here", null), everyoneElse()])).toThrow(
      BadRequestException,
    );
  });

  it("refuses two groups with one id as a bad request", () => {
    expect(() =>
      check([draft("Here", "true", { id: "x" }), everyoneElse({ id: "x" })]),
    ).toThrow("Each group needs its own id.");
  });

  it("keeps a tick only while the group's work is what it was ticked for", () => {
    const [optionalOnly, required] = groups([
      draft("Optional", "true", {
        noRequiredWorkTick: true,
        cells: [{ actionId: 1, assignment: CellAssignment.Optional }],
      }),
      draft("Required", "false", {
        noRequiredWorkTick: true,
        cells: [{ actionId: 1, assignment: CellAssignment.Required }],
      }),
      everyoneElse({ noRequiredWorkTick: true }),
    ]);
    expect(optionalOnly.noRequiredWorkTick).toBe(GroupWork.OptionalOnly);
    expect(required.noRequiredWorkTick).toBeNull();
  });

  it("warns about a group an earlier group covers through a formula and &&", () => {
    const checked = check([
      draft("Maybe", "maybe", { fallback: GroupFallback.PutHere }),
      draft("Maybe and more", 'maybe && isOnList("A")', {
        fallback: GroupFallback.PutHere,
      }),
      everyoneElse({ noRequiredWorkTick: true }),
    ]);
    expect(R.unwrap(checked).warnings).toContainEqual({
      groupId: "Maybe and more-id",
      message:
        'No member can reach "Maybe and more": everyone it matches is placed in "Maybe" first.',
    });
  });

  it("doesn't call a group covered by one that continues undecided members", () => {
    const checked = check([
      draft("Maybe", "maybe", { fallback: GroupFallback.Continue }),
      draft("Maybe again", "maybe", {
        fallback: GroupFallback.PutHere,
        noRequiredWorkTick: true,
      }),
      everyoneElse({ noRequiredWorkTick: true }),
    ]);
    expect(
      R.unwrap(checked).warnings.filter(
        (each) => each.groupId === "Maybe again-id",
      ),
    ).toEqual([]);
  });

  it("refuses an input read, which splits can't wait for yet", () => {
    const withInput: Scope = {
      ...scope,
      catalog: {
        ...scope.catalog,
        inputs: [
          { id: "answer", label: "Answer", type: { kind: TypeKind.Boolean } },
        ],
      },
    };
    const checked = checkSplit({
      drafts: [draft("Answered", "answer"), everyoneElse()],
      scope: withInput,
      actionIds: ACTIONS,
    });
    expect(checked).toEqual(
      R.failure([{ groupId: "Answered-id", message: ONLY_LISTS_AND_FORMULAS }]),
    );
  });
});

describe("resolveGroup", () => {
  const split = groups([
    draft("Maybe", "maybe", { fallback: GroupFallback.Continue }),
    draft("Broken", "1 / 0 > 1"),
    everyoneElse(),
  ]);

  it("continues an undecided member and stops at an error, never reaching Everyone else", () => {
    const resolution = resolveGroup({
      groups: split,
      scope,
      isOnList: () => false,
    });
    expect(resolution.kind).toBe(ResolutionKind.CouldNotDecide);
    expect(resolution.trace.steps.map((step) => step.outcome)).toEqual([
      TraceOutcome.UndecidedContinued,
      TraceOutcome.Error,
    ]);
  });

  it("places a member the condition matches and records the lists read", () => {
    expect(
      resolveGroup({ groups: split, scope, isOnList: () => true }),
    ).toEqual({
      kind: ResolutionKind.Placed,
      groupId: "Maybe-id",
      trace: {
        steps: [{ groupId: "Maybe-id", outcome: TraceOutcome.Matched }],
        lists: [{ listId: "list-a", on: true }],
      },
    });
  });
});

describe("previewSplit", () => {
  it("counts groups, kinds of work and errors", () => {
    const split = groups([
      draft("Listed", 'isOnList("A")', {
        cells: [{ actionId: 1, assignment: CellAssignment.Optional }],
      }),
      draft("Broken", "1 / 0 > 1"),
      everyoneElse(),
    ]);
    const preview = previewSplit({
      groups: split,
      scope,
      actionIds: ACTIONS,
      userIds: [1, 2, 3],
      members: new Map([["list-a", new Set([1])]]),
    });
    expect(preview.groups).toEqual([
      { groupId: "Listed-id", count: 1 },
      { groupId: "Broken-id", count: 0 },
      { groupId: `${EVERYONE_ELSE}-id`, count: 0 },
    ]);
    expect(preview.byWork).toEqual({
      [GroupWork.Required]: 0,
      [GroupWork.OptionalOnly]: 1,
      [GroupWork.Nothing]: 0,
    });
    expect(preview.couldNotDecide).toBe(2);
    expect(preview.errors).toEqual([{ message: expect.any(String), count: 2 }]);
  });
});

describe("impliedOptional", () => {
  it("is optional only when every group assigning the action makes it optional", () => {
    const optionalCell = {
      actionId: 1,
      assignment: CellAssignment.Optional as const,
    };
    const requiredCell = {
      actionId: 1,
      assignment: CellAssignment.Required as const,
    };
    expect(impliedOptional([{ cells: [optionalCell] }, { cells: [] }], 1)).toBe(
      true,
    );
    expect(
      impliedOptional(
        [{ cells: [optionalCell] }, { cells: [requiredCell] }],
        1,
      ),
    ).toBe(false);
    expect(impliedOptional([{ cells: [] }], 1)).toBe(false);
  });
});
