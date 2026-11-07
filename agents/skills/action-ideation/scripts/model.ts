import { createHash } from "node:crypto";
import { z } from "zod";
import { R, type Result } from "../../../../common/src/result";

const text = z.string().trim().min(1);
const id = text.regex(/^[A-Za-z0-9_-]+$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const distinct = <T>(items: T[]) => new Set(items).size === items.length;

export enum AtomBasis {
  Observed = "observed",
  Extension = "extension",
}

export const bankSchema = z
  .object({
    version: z.number().int().positive(),
    atoms: z
      .array(
        z.object({
          id,
          mechanism: text,
          basis: z.enum(AtomBasis),
          source_action_ids: z.array(z.number().int().positive()),
        }),
      )
      .min(2),
  })
  .refine(
    (bank) => distinct(bank.atoms.map((atom) => atom.id)),
    "Duplicate atom IDs",
  );

const dimensions = z.object({
  value: z.number().int().min(1).max(5),
  novelty: z.number().int().min(1).max(5),
  member_experience: z.number().int().min(1).max(5),
  feasibility: z.number().int().min(1).max(5),
});
export const rubricSchema = z.object({
  weights: dimensions,
  anchors: z.object({
    value: text,
    novelty: text,
    member_experience: text,
    feasibility: text,
  }),
  interpretation: text,
});

export const candidateSchema = z
  .object({
    id,
    title: text,
    priority: text.describe(
      "Mission area or organizational goal served, using this run’s requirements.",
    ),
    member_task: text,
    minutes: text,
    anywhere_anytime: text,
    why_collective: text,
    office_work: text,
    intended_change: text,
    closest_precedent: text,
    difference: text,
    key_assumption: text,
    smallest_pilot: text,
    rejection_reason: text.nullable(),
  })
  .strict();

export const assessmentSchema = z
  .object({
    id,
    candidate_hash: digest,
    plan_hash: digest,
    constraint_failures: z.array(text),
    scores: dimensions.nullable(),
    reason: text,
    biggest_uncertainty: text,
    suggested_refinement: text,
  })
  .strict();

export const planSchema = z
  .object({
    run_id: id,
    seed: z.number().int().safe(),
    bank_version: z.number().int().positive(),
    focuses: z.array(text),
    inputs: z.record(z.string(), text),
    combinations: z
      .array(
        z.object({
          id,
          atom_ids: z.array(id).length(2),
          focus: text.nullable(),
          topic: text.nullable(),
          parent_id: id.nullable(),
        }),
      )
      .min(1),
  })
  .refine(
    (plan) => distinct(plan.combinations.map((item) => item.id)),
    "Duplicate candidate IDs",
  );

export type Bank = z.infer<typeof bankSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type Rubric = z.infer<typeof rubricSchema>;

export function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function candidateHash(candidate: Candidate): string {
  return hash(JSON.stringify(candidate, Object.keys(candidateSchema.shape)));
}

export function planHash(plan: Plan): string {
  return hash(JSON.stringify(plan));
}

export function validate<T>(schema: z.ZodType<T>, value: unknown): Result<T> {
  const parsed = schema.safeParse(value);
  return parsed.success ? R.success(parsed.data) : R.failure(parsed.error);
}

export function sample(input: {
  bank: Bank;
  previous: Plan[];
  parents: string[];
  runId: string;
  seed: number;
  count: number;
  focuses: string[];
  topics: string[];
}): Result<Plan> {
  const { bank, previous, parents, runId, seed, count, focuses, topics } =
    input;
  const prior = previous.flatMap((plan) => plan.combinations);
  if (!distinct(prior.map((item) => item.id)) || !distinct(parents)) {
    return R.failure(
      new Error("Duplicate previous candidate IDs or parent selections"),
    );
  }
  const pairKey = (ids: string[]) => [...ids].sort().join("/");
  const used = new Set(prior.map((item) => pairKey(item.atom_ids)));
  const atoms = bank.atoms.map((atom) => atom.id).sort();
  const pairs = atoms.flatMap((first, i) =>
    atoms.slice(i + 1).map((second) => [first, second]),
  );
  const available = pairs.filter((pair) => !used.has(pairKey(pair)));
  available.sort((a, b) =>
    hash(`${seed}:${pairKey(a)}`).localeCompare(hash(`${seed}:${pairKey(b)}`)),
  );
  if (!Number.isSafeInteger(count) || count < 0 || count > available.length) {
    return R.failure(
      new Error(
        `Requested ${count} fresh pairs; ${available.length} unused pairs available`,
      ),
    );
  }
  const counts = new Map(atoms.map((atom) => [atom, 0]));
  const usage = (pair: string[]) =>
    pair.reduce((sum, atom) => sum + (counts.get(atom) ?? 0), 0);
  const combinations: Plan["combinations"] = [];
  for (let i = 0; i < count; i++) {
    available.sort((a, b) => usage(a) - usage(b));
    const pair = available.shift();
    if (!pair) return R.failure(new Error("No unused pair remains"));
    pair.forEach((atom) => counts.set(atom, (counts.get(atom) ?? 0) + 1));
    combinations.push({
      id: `${runId}-${String(i + 1).padStart(3, "0")}`,
      atom_ids: pair,
      focus: focuses[i % focuses.length] ?? null,
      topic: topics.length
        ? topics[
            Number.parseInt(hash(`${seed}:topic:${i}`).slice(0, 8), 16) %
              topics.length
          ]
        : null,
      parent_id: null,
    });
  }
  for (const parentId of parents) {
    const parent = prior.find((item) => item.id === parentId);
    if (!parent || parent.atom_ids.some((atom) => !atoms.includes(atom))) {
      return R.failure(
        new Error(`Unknown parent or retired parent atoms: ${parentId}`),
      );
    }
    combinations.push({
      ...parent,
      id: `${runId}-${String(combinations.length + 1).padStart(3, "0")}`,
      parent_id: parentId,
    });
  }
  if (combinations.some((item) => prior.some((old) => old.id === item.id))) {
    return R.failure(
      new Error(
        "Run ID overlaps a previous run; choose a unique directory name",
      ),
    );
  }
  return validate(planSchema, {
    run_id: runId,
    seed,
    bank_version: bank.version,
    focuses,
    inputs: {},
    combinations,
  });
}

export function rank(input: {
  plan: Plan;
  candidates: Candidate[];
  assessments: Assessment[];
  rubric: Rubric;
}) {
  const { plan, candidates, assessments, rubric } = input;
  const expected = new Set(plan.combinations.map((item) => item.id));
  for (const [label, items] of [
    ["candidates", candidates],
    ["assessments", assessments],
  ] as const) {
    if (
      items.length !== expected.size ||
      !distinct(items.map((item) => item.id)) ||
      items.some((item) => !expected.has(item.id))
    ) {
      return R.failure(
        new Error(`${label} must contain every planned ID exactly once`),
      );
    }
  }
  const ranked: {
    candidate: Candidate;
    assessment: Assessment;
    combination: Plan["combinations"][number];
    total: number;
  }[] = [];
  const excluded = [];
  const planIdentity = planHash(plan);
  for (const candidate of candidates) {
    const assessment = assessments.find((item) => item.id === candidate.id);
    const combination = plan.combinations.find(
      (item) => item.id === candidate.id,
    );
    if (!assessment || !combination)
      return R.failure(new Error(`Missing evidence for ${candidate.id}`));
    if (assessment.plan_hash !== planIdentity) {
      return R.failure(
        new Error(
          `Plan changed since review: ${candidate.id}. Start a new run.`,
        ),
      );
    }
    if (assessment.candidate_hash !== candidateHash(candidate)) {
      return R.failure(
        new Error(
          `Candidate changed since review: ${candidate.id}. Obtain a fresh review.`,
        ),
      );
    }
    const eligible =
      candidate.rejection_reason === null &&
      assessment.constraint_failures.length === 0;
    if (eligible !== (assessment.scores !== null)) {
      return R.failure(
        new Error(
          `${candidate.id}: eligible proposals need scores; exclusions need null scores`,
        ),
      );
    }
    const entry = { candidate, assessment, combination };
    if (assessment.scores === null) {
      excluded.push(entry);
      continue;
    }
    const s = assessment.scores;
    const w = rubric.weights;
    ranked.push({
      ...entry,
      total:
        s.value * w.value +
        s.novelty * w.novelty +
        s.member_experience * w.member_experience +
        s.feasibility * w.feasibility,
    });
  }
  ranked.sort(
    (a, b) => b.total - a.total || a.candidate.id.localeCompare(b.candidate.id),
  );
  return R.success({
    ranked: ranked.map((entry) => ({
      ...entry,
      rank: 1 + ranked.filter((other) => other.total > entry.total).length,
    })),
    excluded,
  });
}
