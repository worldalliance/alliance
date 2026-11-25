import { TypeKind, type Scope } from "@alliance/common/expression/catalog";
import { parseExpression } from "@alliance/common/expression/parse";
import { R } from "@alliance/common/result";
import { CellAssignment, PartWork } from "@alliance/common/suite-partition";
import { BadRequestException } from "@nestjs/common";
import { catalogWith } from "src/formulas/formula-catalog";
import {
  checkPartition,
  ONLY_LISTS_AND_FORMULAS,
  type PartDraft,
} from "./partition-check";
import {
  EVERYONE_ELSE,
  impliedOptional,
  PartFallback,
  type PartitionPart,
} from "./partition-parts";
import { previewPartition } from "./partition-preview";
import { ResolutionKind, resolvePart, TraceOutcome } from "./partition-resolve";

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
  overrides: Partial<PartDraft> = {},
): PartDraft => ({
  id: `${name}-id`,
  name,
  text,
  fallback: null,
  noRequiredWorkTick: false,
  cells: [],
  ...overrides,
});
const everyoneElse = (overrides: Partial<PartDraft> = {}) =>
  draft(EVERYONE_ELSE, null, overrides);
const check = (drafts: PartDraft[]) =>
  checkPartition({ drafts, scope, actionIds: ACTIONS });
const parts = (drafts: PartDraft[]): PartitionPart[] => {
  const checked = check(drafts);
  if (!checked.ok) throw new Error(JSON.stringify(checked.error));
  return checked.value.parts;
};

describe("checkPartition", () => {
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
          partId: " here -id",
          message: 'Another part is already called "here".',
        },
        { partId: " -id", message: "Name the part in 1 to 100 characters." },
      ]),
    );
  });

  it("refuses a partition not ending in Everyone else as a bad request", () => {
    expect(() => check([draft("Here", "true")])).toThrow(BadRequestException);
    expect(() => check([draft("Here", null), everyoneElse()])).toThrow(
      BadRequestException,
    );
  });

  it("refuses two parts with one id as a bad request", () => {
    expect(() =>
      check([draft("Here", "true", { id: "x" }), everyoneElse({ id: "x" })]),
    ).toThrow("Each part needs its own id.");
  });

  it("keeps a tick only while the part's work is what it was ticked for", () => {
    const [optionalOnly, required] = parts([
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
    expect(optionalOnly.noRequiredWorkTick).toBe(PartWork.OptionalOnly);
    expect(required.noRequiredWorkTick).toBeNull();
  });

  it("warns about a part an earlier part covers through a formula and &&", () => {
    const checked = check([
      draft("Maybe", "maybe", { fallback: PartFallback.PutHere }),
      draft("Maybe and more", 'maybe && isOnList("A")', {
        fallback: PartFallback.PutHere,
      }),
      everyoneElse({ noRequiredWorkTick: true }),
    ]);
    expect(R.unwrap(checked).warnings).toContainEqual({
      partId: "Maybe and more-id",
      message:
        'No member can reach "Maybe and more": everyone it matches is placed in "Maybe" first.',
    });
  });

  it("doesn't call a part covered by one that continues undecided members", () => {
    const checked = check([
      draft("Maybe", "maybe", { fallback: PartFallback.Continue }),
      draft("Maybe again", "maybe", {
        fallback: PartFallback.PutHere,
        noRequiredWorkTick: true,
      }),
      everyoneElse({ noRequiredWorkTick: true }),
    ]);
    expect(
      R.unwrap(checked).warnings.filter(
        (each) => each.partId === "Maybe again-id",
      ),
    ).toEqual([]);
  });

  it("refuses an input read, which partitions can't wait for yet", () => {
    const withInput: Scope = {
      ...scope,
      catalog: {
        ...scope.catalog,
        inputs: [
          { id: "answer", label: "Answer", type: { kind: TypeKind.Boolean } },
        ],
      },
    };
    const checked = checkPartition({
      drafts: [draft("Answered", "answer"), everyoneElse()],
      scope: withInput,
      actionIds: ACTIONS,
    });
    expect(checked).toEqual(
      R.failure([{ partId: "Answered-id", message: ONLY_LISTS_AND_FORMULAS }]),
    );
  });
});

describe("resolvePart", () => {
  const partition = parts([
    draft("Maybe", "maybe", { fallback: PartFallback.Continue }),
    draft("Broken", "1 / 0 > 1"),
    everyoneElse(),
  ]);

  it("continues an undecided member and stops at an error, never reaching Everyone else", () => {
    const resolution = resolvePart({
      parts: partition,
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
      resolvePart({ parts: partition, scope, isOnList: () => true }),
    ).toEqual({
      kind: ResolutionKind.Placed,
      partId: "Maybe-id",
      trace: {
        steps: [{ partId: "Maybe-id", outcome: TraceOutcome.Matched }],
        lists: [{ listId: "list-a", on: true }],
      },
    });
  });
});

describe("previewPartition", () => {
  it("counts parts, kinds of work and errors", () => {
    const partition = parts([
      draft("Listed", 'isOnList("A")', {
        cells: [{ actionId: 1, assignment: CellAssignment.Optional }],
      }),
      draft("Broken", "1 / 0 > 1"),
      everyoneElse(),
    ]);
    const preview = previewPartition({
      parts: partition,
      scope,
      actionIds: ACTIONS,
      userIds: [1, 2, 3],
      members: new Map([["list-a", new Set([1])]]),
    });
    expect(preview.parts).toEqual([
      { partId: "Listed-id", count: 1 },
      { partId: "Broken-id", count: 0 },
      { partId: `${EVERYONE_ELSE}-id`, count: 0 },
    ]);
    expect(preview.byWork).toEqual({
      [PartWork.Required]: 0,
      [PartWork.OptionalOnly]: 1,
      [PartWork.Nothing]: 0,
    });
    expect(preview.couldNotDecide).toBe(2);
    expect(preview.errors).toEqual([{ message: expect.any(String), count: 2 }]);
  });
});

describe("impliedOptional", () => {
  it("is optional only when every part assigning the action makes it optional", () => {
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
