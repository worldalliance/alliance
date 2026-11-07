import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { R, type Result } from "../../../../common/src/result";
import {
  assessmentSchema,
  bankSchema,
  candidateSchema,
  hash,
  planHash,
  planSchema,
  rank,
  rubricSchema,
  sample,
  validate,
  type Assessment,
  type Candidate,
  type Plan,
} from "./model";

const skillDir = path.resolve(import.meta.dir, "..");
const scratchDir = path.resolve(skillDir, "../../..", ".scratch");
const integer = z
  .string()
  .regex(/^-?\d+$/)
  .transform(Number)
  .pipe(z.number().int().safe());
const words = z.array(z.string().trim().min(1));

enum Command {
  Sample = "sample",
  Rank = "rank",
}

async function read<T>(file: string, schema: z.ZodType<T>): Promise<Result<T>> {
  return R.fromPromiseFn(async () =>
    R.unwrap(validate(schema, await Bun.file(file).json())),
  );
}

function workingDirectory(directory: string): Result<string> {
  const resolved = path.resolve(directory);
  return resolved.startsWith(`${scratchDir}${path.sep}`)
    ? R.success(resolved)
    : R.failure(
        new Error("Run directories must be inside this checkout's .scratch/"),
      );
}

async function frozenPlan(directory: string) {
  return R.fromPromiseFn(async () => {
    const file = (name: string) => path.join(directory, name);
    const plan = R.unwrap(await read(file("plan.json"), planSchema));
    if (
      planHash(plan) !== (await Bun.file(file("plan.sha256")).text()).trim()
    ) {
      R.unwrap(
        R.failure(
          new Error("Plan changed. Start a new run to change frozen inputs."),
        ),
      );
    }
    for (const [name, expectedHash] of Object.entries(plan.inputs)) {
      if (
        path.basename(name) !== name ||
        hash(await Bun.file(file(name)).text()) !== expectedHash
      ) {
        R.unwrap(
          R.failure(
            new Error(
              `Input changed: ${name}. Start a new run to change frozen inputs.`,
            ),
          ),
        );
      }
    }
    return plan;
  });
}

async function verifyCompletedOutput(
  directory: string,
  input: { plan: Plan; candidates: Candidate[]; assessments: Assessment[] },
): Promise<Result<void>> {
  return R.fromPromiseFn(async () => {
    const recorded = R.unwrap(
      await read(
        path.join(directory, "results.json"),
        z.object({
          output_hashes: z.object({
            plan: z.string(),
            candidates: z.string(),
            assessments: z.string(),
          }),
        }),
      ),
    );
    for (const name of ["plan", "candidates", "assessments"] as const) {
      if (hash(JSON.stringify(input[name])) !== recorded.output_hashes[name]) {
        R.unwrap(
          R.failure(
            new Error(
              `Completed run ${name} changed. Start a new run to revise completed output.`,
            ),
          ),
        );
      }
    }
  });
}

async function previousRun(directory: string) {
  return R.fromPromiseFn(async () => {
    const file = (name: string) => path.join(directory, name);
    const [plan, candidates, assessments, rubric] = await Promise.all([
      frozenPlan(directory),
      read(file("candidates.json"), z.array(candidateSchema)),
      read(file("assessments.json"), z.array(assessmentSchema)),
      read(file("rubric.json"), rubricSchema),
    ]);
    const input = {
      plan: R.unwrap(plan),
      candidates: R.unwrap(candidates),
      assessments: R.unwrap(assessments),
      rubric: R.unwrap(rubric),
    };
    R.unwrap(await verifyCompletedOutput(directory, input));
    R.unwrap(rank(input));
    return { ...input, feedback: await Bun.file(file("feedback.md")).text() };
  });
}

async function prepare(input: {
  directory: string;
  history: string;
  directions: string | undefined;
  seed: number;
  count: number;
  previous: string[];
  parents: string[];
  focuses: string[];
}): Promise<Result<void>> {
  return R.fromPromiseFn(async () => {
    const directory = R.unwrap(workingDirectory(input.directory));
    const names = [
      "requirements.md",
      "atoms.json",
      "facets.json",
      "rubric.json",
      "generation.md",
      "review.md",
    ];
    const contents = await Promise.all(
      names.map(
        async (name) =>
          [name, await Bun.file(path.join(skillDir, name)).text()] as const,
      ),
    );
    const snapshots: Record<string, string> = Object.fromEntries(contents);
    const bank = R.unwrap(
      validate(bankSchema, JSON.parse(snapshots["atoms.json"])),
    );
    const facets = R.unwrap(
      validate(
        z.record(z.string(), words),
        JSON.parse(snapshots["facets.json"]),
      ),
    );
    R.unwrap(validate(rubricSchema, JSON.parse(snapshots["rubric.json"])));
    const history = await Bun.file(input.history).text();
    R.unwrap(validate(z.string().trim().min(1), history));
    const directions =
      input.directions === undefined
        ? "No additional directions for this run.\n"
        : await Bun.file(input.directions).text();
    R.unwrap(validate(z.string().trim().min(1), directions));
    const previous = (await Promise.all(input.previous.map(previousRun))).map(
      (result) => R.unwrap(result),
    );
    const plan = R.unwrap(
      sample({
        bank,
        previous: previous.map((run) => run.plan),
        parents: input.parents,
        runId: path.basename(directory),
        seed: input.seed,
        count: input.count,
        focuses: input.focuses,
        topics: facets.topics ?? [],
      }),
    );
    const unassigned = plan.focuses.filter(
      (focus) => !plan.combinations.some((item) => item.focus === focus),
    );
    if (unassigned.length)
      console.warn(
        `Focus areas not assigned in this batch: ${unassigned.join(", ")}`,
      );
    snapshots["history.txt"] = history;
    snapshots["directions.md"] = directions;
    snapshots["prior.json"] = JSON.stringify(previous, null, 2) + "\n";
    snapshots["output-schemas.json"] =
      JSON.stringify(
        {
          candidates: z.toJSONSchema(z.array(candidateSchema)),
          assessments: z.toJSONSchema(z.array(assessmentSchema)),
        },
        null,
        2,
      ) + "\n";
    plan.inputs = Object.fromEntries(
      Object.entries(snapshots).map(([name, content]) => [name, hash(content)]),
    );
    await mkdir(path.dirname(directory), { recursive: true });
    await mkdir(directory);
    await Promise.all(
      Object.entries({
        ...snapshots,
        "plan.json": JSON.stringify(plan, null, 2) + "\n",
        "plan.sha256": planHash(plan) + "\n",
        "feedback.md": "# Human feedback\n\n",
      }).map(([name, content]) =>
        Bun.write(path.join(directory, name), content),
      ),
    );
    console.log(
      `Prepared ${plan.combinations.length} candidates in ${directory}`,
    );
  });
}

async function rankRun(directory: string): Promise<Result<void>> {
  return R.fromPromiseFn(async () => {
    const resolved = R.unwrap(workingDirectory(directory));
    const file = (name: string) => path.join(resolved, name);
    const plan = R.unwrap(await frozenPlan(resolved));
    const [candidateResult, assessmentResult, rubricResult] = await Promise.all(
      [
        read(file("candidates.json"), z.array(candidateSchema)),
        read(file("assessments.json"), z.array(assessmentSchema)),
        read(file("rubric.json"), rubricSchema),
      ],
    );
    const candidates = R.unwrap(candidateResult);
    const assessments = R.unwrap(assessmentResult);
    const rubric = R.unwrap(rubricResult);
    if (await Bun.file(file("results.json")).exists()) {
      R.unwrap(
        await verifyCompletedOutput(resolved, {
          plan,
          candidates,
          assessments,
        }),
      );
    }
    const result = R.unwrap(rank({ plan, candidates, assessments, rubric }));
    const lines = [
      `Alliance action ideas: ${plan.run_id}`,
      `${candidates.length} candidates; ${result.ranked.length} ranked; ${result.excluded.length} excluded.`,
      rubric.interpretation,
      "Equal totals share a rank; ID order within a tie has no quality meaning.",
      "Suggested refinements are unscored. Partner arrangements and time estimates remain assumptions unless verified.",
      "",
      "RANKING",
      ...result.ranked.map(
        (entry) =>
          `${entry.rank}. ${entry.candidate.id} — ${entry.total} — ${entry.candidate.title}`,
      ),
      "",
      "EXCLUDED",
      ...result.excluded.map(
        (entry) =>
          `${entry.candidate.id}: ${[entry.candidate.rejection_reason, ...entry.assessment.constraint_failures].filter(Boolean).join("; ")}`,
      ),
      "",
      "ALL CANDIDATES",
    ];
    for (const entry of [...result.ranked, ...result.excluded]) {
      lines.push(
        "",
        `${entry.candidate.id}: ${entry.candidate.title}`,
        `Atoms: ${entry.combination.atom_ids.join(", ")}; parent: ${entry.combination.parent_id ?? "none"}`,
      );
      for (const [key, value] of Object.entries(entry.candidate)) {
        if (key !== "id" && key !== "title" && value !== null)
          lines.push(`${key}: ${value}`);
      }
      lines.push(
        `Review: ${entry.assessment.reason}`,
        `Scores: ${JSON.stringify(entry.assessment.scores)}`,
        `Uncertainty: ${entry.assessment.biggest_uncertainty}`,
        `Suggested refinement (unscored): ${entry.assessment.suggested_refinement}`,
      );
    }
    const output = {
      plan,
      rubric,
      ...result,
      output_hashes: {
        plan: planHash(plan),
        candidates: hash(JSON.stringify(candidates)),
        assessments: hash(JSON.stringify(assessments)),
        feedback: hash(await Bun.file(file("feedback.md")).text()),
      },
    };
    await Bun.write(
      file("results.json"),
      JSON.stringify(output, null, 2) + "\n",
    );
    await Bun.write(file("report.txt"), lines.join("\n") + "\n");
    console.log(
      `Ranked all ${candidates.length} candidates: ${file("report.txt")}`,
    );
  });
}

async function main(): Promise<Result<void>> {
  return R.fromPromiseFn(async () => {
    const { positionals, values } = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        history: { type: "string" },
        directions: { type: "string" },
        seed: { type: "string" },
        count: { type: "string", default: "20" },
        previous: { type: "string", multiple: true, default: [] },
        refine: { type: "string", multiple: true, default: [] },
        focus: { type: "string", multiple: true, default: [] },
        help: { type: "boolean" },
      },
    });
    if (values.help) {
      console.log(
        "sample <.scratch/run> --history <sanitized-file> --seed <integer> [--directions <sanitized-file>] [--count 20] [--focus <focus>] [--previous <run>] [--refine <candidate-id>]\nrank <.scratch/run>\n--directions snapshots current invocation instructions; omit only when there are none. Repeat --focus, --previous and --refine as needed. Prior runs must retain all sampled inputs, the plan checksum, completed outputs and feedback.",
      );
      return;
    }
    const [command, directory] = R.unwrap(
      validate(z.tuple([z.enum(Command), z.string().min(1)]), positionals),
    );
    switch (command) {
      case Command.Sample:
        R.unwrap(
          await prepare({
            directory,
            history: R.unwrap(validate(z.string().min(1), values.history)),
            directions: values.directions,
            seed: R.unwrap(validate(integer, values.seed)),
            count: R.unwrap(validate(integer, values.count)),
            previous: values.previous,
            parents: values.refine,
            focuses: R.unwrap(validate(words, values.focus)),
          }),
        );
        return;
      case Command.Rank:
        R.unwrap(await rankRun(directory));
        return;
      default:
        command satisfies never;
    }
  });
}

if (import.meta.main) {
  const result = await main();
  if (!result.ok) {
    console.error(`action-ideation: ${result.error.message}`);
    process.exitCode = 1;
  }
}
