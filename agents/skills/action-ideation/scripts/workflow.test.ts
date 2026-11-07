import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { R } from "../../../../common/src/result";
import { candidateHash, hash, planSchema, validate, type Plan } from "./model";
import { assessment, candidate } from "./test-fixtures";

const repo = path.resolve(import.meta.dir, "../../../..");
const script = path.join(import.meta.dir, "workflow.ts");
await mkdir(path.join(repo, ".scratch"), { recursive: true });
const temporary = await mkdtemp(
  path.join(repo, ".scratch/action-ideation-test-"),
);
afterAll(async () => {
  await rm(temporary, { recursive: true, force: true });
});
const history = path.join(temporary, "history.txt");
await Bun.write(history, "Synthetic history; no real members or actions.\n");
const cli = (...args: string[]) =>
  Bun.spawnSync(["bun", script, ...args], { cwd: repo });
const prepare = (directory: string) =>
  cli("sample", directory, "--history", history, "--seed", "1", "--count", "1");

enum EditedOutput {
  Candidates = "candidates",
  Assessments = "assessments",
}

async function populate(directory: string) {
  const current = await Bun.file(path.join(directory, "plan.json")).json();
  const parsed = R.unwrap(validate(planSchema, current));
  await Bun.write(
    path.join(directory, "candidates.json"),
    JSON.stringify(parsed.combinations.map((item) => candidate(item.id))),
  );
  await Bun.write(
    path.join(directory, "assessments.json"),
    JSON.stringify(
      parsed.combinations.map((item) => assessment(item.id, parsed)),
    ),
  );
  return parsed;
}

describe("workflow CLI", () => {
  test("rejects a changed proposal's old review before the first ranking", async () => {
    const directory = path.join(temporary, "stale-review");
    expect(prepare(directory).exitCode).toBe(0);
    const current = await populate(directory);
    const changed = {
      ...candidate(current.combinations[0].id),
      member_task: "Attend a fixed-place, fixed-time meeting",
      anywhere_anytime: "Required live attendance",
    };
    await Bun.write(
      path.join(directory, "candidates.json"),
      JSON.stringify([changed]),
    );
    const ranked = cli("rank", directory);
    expect(ranked.exitCode).toBe(1);
    expect(ranked.stderr.toString()).toContain(
      "Candidate changed since review",
    );
    expect(await Bun.file(path.join(directory, "results.json")).exists()).toBe(
      false,
    );
    await Bun.write(
      path.join(directory, "assessments.json"),
      JSON.stringify([
        {
          ...assessment(changed.id, current),
          candidate_hash: candidateHash(changed),
          constraint_failures: ["Requires live attendance"],
          scores: null,
        },
      ]),
    );
    expect(cli("rank", directory).exitCode).toBe(0);
    const results = await Bun.file(path.join(directory, "results.json")).json();
    expect(results.ranked).toHaveLength(0);
    expect(results.excluded).toHaveLength(1);
  });

  test.each(Object.values(EditedOutput))(
    "rejects edited completed %s on reranking and refinement without overwriting results",
    async (changedFile) => {
      const directory = path.join(temporary, `completed-${changedFile}`);
      expect(prepare(directory).exitCode).toBe(0);
      const current = await populate(directory);
      expect(cli("rank", directory).exitCode).toBe(0);
      const results = await Bun.file(
        path.join(directory, "results.json"),
      ).text();
      const report = await Bun.file(path.join(directory, "report.txt")).text();
      await Bun.write(
        path.join(directory, "feedback.md"),
        "Human feedback on the original proposal.",
      );
      const id = current.combinations[0].id;
      switch (changedFile) {
        case EditedOutput.Candidates: {
          const changed = {
            ...candidate(id),
            member_task: "Attend a scheduled meeting",
          };
          await Bun.write(
            path.join(directory, "candidates.json"),
            JSON.stringify([changed]),
          );
          await Bun.write(
            path.join(directory, "assessments.json"),
            JSON.stringify([
              {
                ...assessment(id, current),
                candidate_hash: candidateHash(changed),
              },
            ]),
          );
          break;
        }
        case EditedOutput.Assessments:
          await Bun.write(
            path.join(directory, "assessments.json"),
            JSON.stringify([
              {
                ...assessment(id, current),
                reason: "A different review",
              },
            ]),
          );
          break;
        default:
          changedFile satisfies never;
      }
      const next = path.join(temporary, `after-${changedFile}`);
      const prepared = cli(
        "sample",
        next,
        "--history",
        history,
        "--seed",
        "2",
        "--count",
        "0",
        "--previous",
        directory,
        "--refine",
        current.combinations[0].id,
      );
      expect(prepared.exitCode).toBe(1);
      expect(prepared.stderr.toString()).toContain(
        `Completed run ${changedFile} changed`,
      );
      expect(await Bun.file(path.join(next, "prior.json")).exists()).toBe(
        false,
      );
      expect(cli("rank", directory).exitCode).toBe(1);
      expect(await Bun.file(path.join(directory, "results.json")).text()).toBe(
        results,
      );
      expect(await Bun.file(path.join(directory, "report.txt")).text()).toBe(
        report,
      );
    },
  );

  test("snapshots inputs, ranks a full pool, and carries prior feedback into refinement", async () => {
    const first = path.join(temporary, "first");
    const directions = path.join(temporary, "directions.md");
    const instruction = "For this round only, exclude donation ideas.\n";
    await Bun.write(directions, instruction);
    const persistent = Bun.file(
      path.resolve(import.meta.dir, "../requirements.md"),
    );
    const requirements = await persistent.text();
    expect(
      cli(
        "sample",
        first,
        "--history",
        history,
        "--seed",
        "1",
        "--count",
        "2",
        "--directions",
        directions,
      ).exitCode,
    ).toBe(0);
    const firstPlan = await populate(first);
    expect(await Bun.file(path.join(first, "directions.md")).text()).toBe(
      instruction,
    );
    expect(firstPlan.inputs["directions.md"]).toBe(hash(instruction));
    expect(await Bun.file(path.join(first, "requirements.md")).text()).toBe(
      requirements,
    );
    expect(await persistent.text()).toBe(requirements);
    await Bun.write(directions, "Directions for a later invocation.\n");
    expect(
      cli(
        "sample",
        path.join(temporary, "unfinished"),
        "--history",
        history,
        "--seed",
        "2",
        "--count",
        "1",
        "--previous",
        first,
      ).exitCode,
    ).toBe(1);
    const ranked = cli("rank", first);
    expect(ranked.stderr.toString()).toBe("");
    expect(ranked.exitCode).toBe(0);
    expect(await Bun.file(path.join(first, "report.txt")).text()).toContain(
      "Equal totals share a rank",
    );
    expect(cli("rank", first).exitCode).toBe(0);
    await Bun.write(
      path.join(first, "feedback.md"),
      "Human feedback: the examples are too abstract.",
    );
    const second = path.join(temporary, "second");
    const prepared = cli(
      "sample",
      second,
      "--history",
      history,
      "--seed",
      "2",
      "--count",
      "1",
      "--previous",
      first,
      "--refine",
      firstPlan.combinations[0].id,
    );
    expect(prepared.stderr.toString()).toBe("");
    expect(prepared.exitCode).toBe(0);
    expect(await Bun.file(path.join(second, "directions.md")).text()).toBe(
      "No additional directions for this run.\n",
    );
    expect(await Bun.file(path.join(second, "prior.json")).text()).toContain(
      "examples are too abstract",
    );
    expect(await Bun.file(path.join(second, "plan.json")).text()).toContain(
      firstPlan.combinations[0].id,
    );
  });

  test.each(["requirements.md", "directions.md"])(
    "refuses output overwrites, modified frozen %s and missing reviews",
    async (name) => {
      const directory = path.join(
        temporary,
        `guarded-${path.parse(name).name}`,
      );
      const args = [
        "sample",
        directory,
        "--history",
        history,
        "--seed",
        "3",
        "--count",
        "1",
      ];
      expect(cli(...args).exitCode).toBe(0);
      expect(cli(...args).exitCode).toBe(1);
      expect(cli("rank", directory).exitCode).toBe(1);
      await populate(directory);
      await Bun.write(path.join(directory, name), "Changed requirements");
      const ranked = cli("rank", directory);
      expect(ranked.exitCode).toBe(1);
      expect(ranked.stderr.toString()).toContain(`Input changed: ${name}`);
    },
  );

  test.each([" \n", null])(
    "rejects blank or unreadable directions: %j",
    async (content) => {
      const directory = path.join(
        temporary,
        content === null ? "missing-directions" : "blank-directions",
      );
      const directions = `${directory}.md`;
      if (content !== null) await Bun.write(directions, content);
      const run = cli(
        "sample",
        directory,
        "--history",
        history,
        "--seed",
        "1",
        "--directions",
        directions,
      );
      expect(run.exitCode).toBe(1);
      expect(await Bun.file(path.join(directory, "plan.json")).exists()).toBe(
        false,
      );
    },
  );

  test("preserves the full requested focus list and reports uncovered areas", async () => {
    const directory = path.join(temporary, "focuses");
    const run = cli(
      "sample",
      directory,
      "--history",
      history,
      "--seed",
      "3",
      "--count",
      "1",
      "--focus",
      "First focus",
      "--focus",
      "Second focus",
    );
    expect(run.exitCode).toBe(0);
    expect(run.stderr.toString()).toContain(
      "Focus areas not assigned in this batch: Second focus",
    );
    const saved = R.unwrap(
      validate(
        planSchema,
        await Bun.file(path.join(directory, "plan.json")).json(),
      ),
    );
    expect(saved.focuses).toEqual(["First focus", "Second focus"]);
  });

  test("restricts run outputs to the checkout's scratch directory", () => {
    expect(
      cli(
        "sample",
        path.join(repo, "forbidden-ideation-output"),
        "--history",
        history,
        "--seed",
        "1",
      ).exitCode,
    ).toBe(1);
  });
});

const planEdits: { name: string; edit: (plan: Plan) => void }[] = [
  {
    name: "run ID",
    edit: (plan) => {
      plan.run_id = "another-run";
    },
  },
  {
    name: "seed",
    edit: (plan) => {
      plan.seed += 1;
    },
  },
  {
    name: "bank version",
    edit: (plan) => {
      plan.bank_version += 1;
    },
  },
  {
    name: "focuses",
    edit: (plan) => {
      plan.focuses = ["Changed focus"];
    },
  },
  {
    name: "input manifest",
    edit: (plan) => {
      plan.inputs = {};
    },
  },
  {
    name: "atom assignments",
    edit: (plan) => {
      plan.combinations[0].atom_ids = ["A01", "A02"];
    },
  },
  {
    name: "combination focus",
    edit: (plan) => {
      plan.combinations[0].focus = "Changed focus";
    },
  },
  {
    name: "topic",
    edit: (plan) => {
      plan.combinations[0].topic = "Changed topic";
    },
  },
  {
    name: "parent",
    edit: (plan) => {
      plan.combinations[0].parent_id = "nonexistent-parent-001";
    },
  },
];

for (const { name, edit } of planEdits) {
  for (const completed of [false, true]) {
    test(`rejects edited ${name} in a ${completed ? "completed" : "pending"} plan`, async () => {
      const directory = path.join(
        temporary,
        `${name.replaceAll(" ", "-")}-${completed}`,
      );
      expect(prepare(directory).exitCode).toBe(0);
      const current = await populate(directory);
      const results = Bun.file(path.join(directory, "results.json"));
      const report = Bun.file(path.join(directory, "report.txt"));
      if (completed) expect(cli("rank", directory).exitCode).toBe(0);
      const saved = completed
        ? { results: await results.text(), report: await report.text() }
        : null;
      const changed = structuredClone(current);
      edit(changed);
      await Bun.write(
        path.join(directory, "plan.json"),
        JSON.stringify(changed),
      );
      const ranked = cli("rank", directory);
      expect(ranked.exitCode).toBe(1);
      expect(ranked.stderr.toString()).toContain("Plan changed");
      if (saved !== null) {
        const next = `${directory}-next`;
        const prepared = cli(
          "sample",
          next,
          "--history",
          history,
          "--seed",
          "2",
          "--count",
          "0",
          "--previous",
          directory,
          "--refine",
          current.combinations[0].id,
        );
        expect(prepared.exitCode).toBe(1);
        expect(prepared.stderr.toString()).toContain("Plan changed");
        expect(await Bun.file(path.join(next, "plan.json")).exists()).toBe(
          false,
        );
        expect(await results.text()).toBe(saved.results);
        expect(await report.text()).toBe(saved.report);
      } else {
        expect(await results.exists()).toBe(false);
        expect(await report.exists()).toBe(false);
      }
    });
  }
}

test("rejects a completion record associated with another plan", async () => {
  const directory = path.join(temporary, "other-completion");
  expect(prepare(directory).exitCode).toBe(0);
  const current = await populate(directory);
  expect(cli("rank", directory).exitCode).toBe(0);
  const file = Bun.file(path.join(directory, "results.json"));
  const recorded = await file.json();
  recorded.output_hashes.plan = "0".repeat(64);
  await Bun.write(file, JSON.stringify(recorded));
  const saved = await file.text();
  const ranked = cli("rank", directory);
  expect(ranked.exitCode).toBe(1);
  expect(ranked.stderr.toString()).toContain("Completed run plan changed");
  const next = `${directory}-next`;
  const prepared = cli(
    "sample",
    next,
    "--history",
    history,
    "--seed",
    "2",
    "--count",
    "0",
    "--previous",
    directory,
    "--refine",
    current.combinations[0].id,
  );
  expect(prepared.exitCode).toBe(1);
  expect(prepared.stderr.toString()).toContain("Completed run plan changed");
  expect(await Bun.file(path.join(next, "plan.json")).exists()).toBe(false);
  expect(await file.text()).toBe(saved);
});

test("requires the plan checksum saved by sampling", async () => {
  const directory = path.join(temporary, "missing-checksum");
  expect(prepare(directory).exitCode).toBe(0);
  await populate(directory);
  await rm(path.join(directory, "plan.sha256"), { force: true });
  expect(cli("rank", directory).exitCode).toBe(1);
  expect(await Bun.file(path.join(directory, "results.json")).exists()).toBe(
    false,
  );
});
