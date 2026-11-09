import { describe, expect, test } from "bun:test";
import path from "node:path";
import { R } from "../../../../common/src/result";
import {
  AtomBasis,
  assessmentSchema,
  bankSchema,
  candidateHash,
  candidateSchema,
  rank,
  rubricSchema,
  sample,
  validate,
  type Bank,
} from "./model";
import { assessment, candidate } from "./test-fixtures";

const bank = {
  version: 1,
  atoms: ["A", "B", "C", "D"].map((id) => ({
    id,
    mechanism: `Synthetic mechanism ${id}`,
    basis: AtomBasis.Extension,
    source_action_ids: [],
  })),
} satisfies Bank;
const rubric = R.unwrap(
  validate(
    rubricSchema,
    await Bun.file(path.resolve(import.meta.dir, "../rubric.json")).json(),
  ),
);
const sampling = {
  bank,
  previous: [],
  parents: [],
  runId: "round1",
  seed: 42,
  count: 3,
  focuses: ["Synthetic focus"],
  topics: ["Synthetic topic"],
};
const plan = R.unwrap(sample(sampling));
const candidates = plan.combinations.map((item) => candidate(item.id));
const assessments = plan.combinations.map((item) => assessment(item.id, plan));

describe("sampling", () => {
  test("rejects duplicate atom IDs in a manually edited bank", () => {
    expect(
      validate(bankSchema, { ...bank, atoms: [bank.atoms[0], bank.atoms[0]] })
        .ok,
    ).toBe(false);
  });

  test("reproduces inputs without repeating pairs and balances atom coverage", () => {
    expect(R.unwrap(sample(sampling))).toEqual(plan);
    expect(
      new Set(plan.combinations.map((item) => item.atom_ids.join("/"))).size,
    ).toBe(3);
    const counts = bank.atoms.map(
      (atom) =>
        plan.combinations.filter((item) => item.atom_ids.includes(atom.id))
          .length,
    );
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(
      plan.combinations.every((item) => item.focus === "Synthetic focus"),
    ).toBe(true);
  });

  test("excludes previous combinations and preserves selected parent lineage", () => {
    const next = R.unwrap(
      sample({
        ...sampling,
        runId: "round2",
        previous: [plan],
        parents: [plan.combinations[0].id],
      }),
    );
    const fresh = next.combinations.filter((item) => item.parent_id === null);
    expect(
      fresh.every(
        (item) =>
          !plan.combinations.some(
            (old) => old.atom_ids.join("/") === item.atom_ids.join("/"),
          ),
      ),
    ).toBe(true);
    expect(next.combinations[3].parent_id).toBe(plan.combinations[0].id);
    expect(next.combinations[3].atom_ids).toEqual(
      plan.combinations[0].atom_ids,
    );
  });

  test("fails on exhausted pairs, unknown parents, duplicate history and reused run IDs", () => {
    expect(sample({ ...sampling, count: 7 }).ok).toBe(false);
    expect(sample({ ...sampling, parents: ["missing"] }).ok).toBe(false);
    expect(sample({ ...sampling, previous: [plan, plan] }).ok).toBe(false);
    expect(sample({ ...sampling, previous: [plan] }).ok).toBe(false);
  });

  test("supports refinement-only runs but refuses empty runs", () => {
    expect(
      sample({
        ...sampling,
        runId: "round2",
        count: 0,
        previous: [plan],
        parents: [plan.combinations[0].id],
      }).ok,
    ).toBe(true);
    expect(sample({ ...sampling, count: 0 }).ok).toBe(false);
  });
});

describe("review validation", () => {
  test("requires a plan association in every assessment", () => {
    expect(
      validate(assessmentSchema, { ...assessments[0], plan_hash: undefined })
        .ok,
    ).toBe(false);
  });

  test("rejects reviews associated with another plan", () => {
    const result = rank({
      plan: { ...plan, seed: plan.seed + 1 },
      candidates,
      assessments,
      rubric,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.message).toContain("Plan changed since review");
  });

  test("preserves ties and separates both constraint failures and generator rejections", () => {
    const result = R.unwrap(rank({ plan, candidates, assessments, rubric }));
    expect(result.ranked.map((item) => item.rank)).toEqual([1, 1, 1]);
    expect(result.ranked[0].total).toBe(24);
    const rejected = candidates.map((item, i) =>
      i === 0 ? { ...item, rejection_reason: "Incoherent combination" } : item,
    );
    const reviews = assessments.map((item, i) =>
      i < 2
        ? {
            ...item,
            candidate_hash: candidateHash(rejected[i]),
            scores: null,
            constraint_failures: i === 1 ? ["Requires live attendance"] : [],
          }
        : item,
    );
    const filtered = R.unwrap(
      rank({ plan, candidates: rejected, assessments: reviews, rubric }),
    );
    expect(filtered.excluded).toHaveLength(2);
    expect(filtered.ranked).toHaveLength(1);
    expect(filtered.ranked[0].rank).toBe(1);
  });

  test("fails instead of silently dropping missing, duplicate or foreign IDs", () => {
    expect(
      rank({ plan, candidates: candidates.slice(1), assessments, rubric }).ok,
    ).toBe(false);
    expect(
      rank({
        plan,
        candidates,
        assessments: [assessments[0], assessments[0], assessments[2]],
        rubric,
      }).ok,
    ).toBe(false);
    expect(
      rank({
        plan,
        candidates,
        assessments: assessments.map((item) => ({ ...item, id: "unknown" })),
        rubric,
      }).ok,
    ).toBe(false);
  });

  test("rejects scored failures, unscored eligible ideas and invalid model scores", () => {
    expect(
      validate(assessmentSchema, {
        ...assessments[0],
        candidate_hash: undefined,
      }).ok,
    ).toBe(false);
    expect(
      rank({
        plan,
        candidates,
        assessments: assessments.map((item) => ({ ...item, scores: null })),
        rubric,
      }).ok,
    ).toBe(false);
    expect(
      rank({
        plan,
        candidates,
        assessments: assessments.map((item) => ({
          ...item,
          constraint_failures: ["Violation"],
        })),
        rubric,
      }).ok,
    ).toBe(false);
    expect(
      validate(assessmentSchema, {
        ...assessments[0],
        scores: { ...assessments[0].scores, value: 6 },
      }).ok,
    ).toBe(false);
    expect(
      validate(candidateSchema, { ...candidates[0], member_task: "" }).ok,
    ).toBe(false);
  });
});
