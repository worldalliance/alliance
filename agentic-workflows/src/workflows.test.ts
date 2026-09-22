import { R } from "@alliance/common/result";
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import * as git from "./git";
import * as jobs from "./jobs";
import { snapshot, startJob, stepJob, stepMessages } from "./jobs";
import { JobKind, JobStatus, RunMode, StepStatus, StepOutputFormat, type Job } from "./types";
import { reviewBaseSteps } from "./workflows";

const sha = "a".repeat(40);
const parent = "b".repeat(40);
const head = "d".repeat(40);
const draftRef = "refs/heads/draft/feature";
const threadId = "00000000-0000-4000-8000-000000000001";
const spawnLogged = jobs.spawnLogged;
const originalStateHome = process.env.XDG_STATE_HOME;
let fixture: string;
let remoteTip: string;
let ancestry: string;
let remainsOnBranch: boolean;
let draftRemoteTip: string;
let currentBranch: string;

const fakeAgent = `#!/usr/bin/env bun
import { appendFileSync, mkdirSync } from "node:fs";
import { basename } from "node:path";
const tool = basename(process.argv[1]);
const args = process.argv.slice(2);
appendFileSync("calls.jsonl", JSON.stringify({ tool, args }) + "\\n");
if (tool === "claude" && await Bun.file("review.json").exists()) {
  const review = await Bun.file("review.json").json();
  mkdirSync(".scratch/review", { recursive: true });
  await Bun.write(".scratch/review/" + "a".repeat(40) + ".json", JSON.stringify(review));
}
const phase = tool === "claude" ? "claude" : args.includes("resume") ? "apply" : "assess";
if (await Bun.file(phase + ".stderr").exists()) process.stderr.write(await Bun.file(phase + ".stderr").text());
process.stdout.write(await Bun.file(phase + ".jsonl").text());
if (await Bun.file(phase + ".wait").exists()) await Bun.sleep(60000);
process.exit(await Bun.file(phase + ".exit").exists() ? 1 : 0);
`;

async function writeEvents(phase: string, events: readonly unknown[]) {
  await Bun.write(
    join(fixture, `${phase}.jsonl`),
    events.map((event) => JSON.stringify(event)).join("\n") + "\n",
  );
}

beforeEach(async () => {
  remoteTip = parent;
  ancestry = `${sha} ${parent}`;
  remainsOnBranch = true;
  draftRemoteTip = "e".repeat(40);
  currentBranch = "feature";
  const scratch = resolve(import.meta.dir, "../../.scratch");
  mkdirSync(scratch, { recursive: true });
  fixture = mkdtempSync(join(scratch, "review-workflow-test-"));
  process.env.XDG_STATE_HOME = join(fixture, "state");
  const bin = join(fixture, "bin");
  mkdirSync(bin);
  for (const tool of ["claude", "codex"]) {
    const path = join(bin, tool);
    await Bun.write(path, fakeAgent);
    chmodSync(path, 0o755);
  }
  spyOn(git, "gitText").mockImplementation(async ({ args }) => {
    switch (args[0]) {
      case "remote":
        return R.success("origin\n");
      case "for-each-ref":
        return R.success("\n");
      case "rev-parse":
        return R.success(`${args.at(-1) === "HEAD" ? head : remoteTip}\n`);
      case "symbolic-ref":
        return R.success(`${currentBranch}\n`);
      case "ls-remote":
        return R.success(
          draftRemoteTip ? `${draftRemoteTip}\t${draftRef}\n` : "",
        );
      case "rev-list":
        return R.success(`${ancestry}\n`);
      case "merge-base":
        return remainsOnBranch ? R.success("") : R.failure("not an ancestor");
      default:
        return R.failure(`Unexpected test git command: ${args.join(" ")}`);
    }
  });
  spyOn(jobs, "spawnLogged").mockImplementation(async (params) => {
    if (params.command[0]?.endsWith("/scripts/commit-after.sh"))
      return R.success(sha);
    if (params.command[0] === "git") {
      appendFileSync(
        join(fixture, "calls.jsonl"),
        JSON.stringify({ tool: "git", args: params.command.slice(1) }) + "\n",
      );
      return params.command.includes(
        `--force-with-lease=refs/heads/main:${remoteTip}`,
      ) ||
        params.command.includes(
          `--force-with-lease=${draftRef}:${draftRemoteTip}`,
        )
        ? R.success("Synthetic push completed")
        : R.failure("Remote branch changed; push rejected");
    }
    return spawnLogged({
      ...params,
      command: params.command.map((arg, index) =>
        index === 0 && (arg === "claude" || arg === "codex")
          ? join(bin, arg)
          : arg,
      ),
    });
  });
  await Bun.write(
    join(fixture, "review.json"),
    JSON.stringify({ base: sha, summary: "Synthetic review", findings: [] }),
  );
  await writeEvents("claude", [
    { type: "result", is_error: false, result: "Review complete" },
  ]);
  await writeEvents("assess", [
    { type: "thread.started", thread_id: threadId },
    {
      type: "item.completed",
      item: {
        type: "agent_message",
        text: JSON.stringify({
          report: "Assessment complete",
          needs_attention: false,
          accepted_findings: 1,
        }),
      },
    },
    { type: "turn.completed" },
  ]);
  await writeEvents("apply", [
    { type: "thread.started", thread_id: threadId },
    {
      type: "item.completed",
      item: {
        type: "agent_message",
        text: JSON.stringify({
          report: "Fixes complete",
          needs_attention: false,
          accepted_findings: 1,
        }),
      },
    },
    { type: "turn.completed" },
  ]);
});

afterEach(async () => {
  for (const job of snapshot()) {
    if (
      job.worktree === fixture &&
      (job.status === JobStatus.Running || job.status === JobStatus.Paused)
    ) {
      jobs.cancelJob(job.id);
      await settled(job.id);
    }
  }
  mock.restore();
  if (originalStateHome === undefined) delete process.env.XDG_STATE_HOME;
  else process.env.XDG_STATE_HOME = originalStateHome;
  rmSync(fixture, { recursive: true, force: true });
});

function start(mode: RunMode): Job {
  const steps = reviewBaseSteps({ path: fixture, remote: "origin/main" });
  return R.unwrap(
    startJob({
      kind: JobKind.ReviewBase,
      label: "Synthetic review",
      worktree: fixture,
      mode,
      steps,
    }),
  );
}

async function settled(id: string): Promise<Job> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const job = snapshot().find((job) => job.id === id);
    if (job && job.status !== JobStatus.Running) return job;
    await Bun.sleep(10);
  }
  throw new Error("Workflow did not settle");
}

async function calls() {
  const lines = (await Bun.file(join(fixture, "calls.jsonl")).text())
    .trim()
    .split("\n");
  return lines.map((line) =>
    z
      .object({ tool: z.string(), args: z.array(z.string()) })
      .parse(JSON.parse(line)),
  );
}

test("archives each round, clears scratch, and resumes the assessment session for fixes", async () => {
  const retained = join(fixture, ".scratch/review/previous.decisions.md");
  await Bun.write(retained, "Deferred synthetic finding");
  const job = await settled(start(RunMode.All).id);
  expect(job.status).toBe(JobStatus.Succeeded);
  expect(job.steps.map((step) => step.id)).toEqual([
    "base",
    "scratch",
    "review",
    "assess",
    "apply",
    "draft",
    "push",
  ]);
  expect(job.steps.slice(2).map((step) => step.output)).toEqual([
    "Review complete",
    "Assessment complete",
    "Fixes complete",
    `Backed up committed work through ${head} to origin/draft/feature.`,
    "Not pushed: this round needs a fresh review with no accepted findings.",
  ]);
  const commands = await calls();
  expect(commands.map((command) => command.tool)).toEqual([
    "claude",
    "codex",
    "codex",
    "git",
  ]);
  expect(commands[1]?.args.slice(0, 5)).toEqual([
    "--sandbox",
    "danger-full-access",
    "--ask-for-approval",
    "never",
    "exec",
  ]);
  expect(commands[1]?.args.at(-1)).toBe(
    `$review-followup assess .scratch/review/${sha}.json`,
  );
  expect(commands[2]?.args.at(-1)).toBe("$review-followup apply");
  expect(commands[2]?.args.slice(5, 7)).toEqual(["resume", threadId]);
  expect(commands[2]?.args).not.toContain("--last");
  expect(stepMessages({ jobId: job.id, stepId: "assess" })).toHaveLength(3);
  expect(await Bun.file(retained).exists()).toBe(false);
  const archive = join(fixture, "state/alliance/agentic-review", job.id);
  expect(
    await Bun.file(join(archive, "previous/previous.decisions.md")).text(),
  ).toBe("Deferred synthetic finding");
  expect(
    (await Bun.file(join(archive, "assess.json")).json()).messages,
  ).toHaveLength(3);
  expect(
    (await Bun.file(join(archive, "review", `${sha}.json`)).json()).base,
  ).toBe(sha);
  expect(await Bun.file(join(archive, "review.stdout.jsonl")).text()).toBe(
    await Bun.file(join(fixture, "claude.jsonl")).text(),
  );
  expect(await Bun.file(join(archive, "assess.stdout.jsonl")).text()).toBe(
    await Bun.file(join(fixture, "assess.jsonl")).text(),
  );
  expect(await Bun.file(join(archive, "apply.stdout.jsonl")).text()).toBe(
    await Bun.file(join(fixture, "apply.jsonl")).text(),
  );
});

test("step mode pauses after assessment before applying", async () => {
  let job = await settled(start(RunMode.Step).id);
  for (const id of ["scratch", "review", "assess"]) {
    R.unwrap(stepJob(job.id));
    job = await settled(job.id);
    expect(job.steps.find((step) => step.id === id)?.status).toBe(
      StepStatus.Succeeded,
    );
    expect(job.status).toBe(JobStatus.Paused);
  }
  expect((await calls()).map((call) => call.tool)).toEqual(["claude", "codex"]);
  expect(job.steps.at(-1)?.status).toBe(StepStatus.Pending);
  R.unwrap(stepJob(job.id));
  job = await settled(job.id);
  expect(job.status).toBe(JobStatus.Paused);
  R.unwrap(stepJob(job.id));
  job = await settled(job.id);
  expect(job.status).toBe(JobStatus.Paused);
  R.unwrap(stepJob(job.id));
  expect((await settled(job.id)).status).toBe(JobStatus.Succeeded);
});

test.each([
  { name: "missing review", review: null },
  {
    name: "wrong base",
    review: { base: "b".repeat(40), summary: "Other review", findings: [] },
  },
])("$name stops before Codex", async ({ review }) => {
  if (review === null) rmSync(join(fixture, "review.json"));
  else await Bun.write(join(fixture, "review.json"), JSON.stringify(review));
  const job = await settled(start(RunMode.All).id);
  expect(job.status).toBe(JobStatus.Failed);
  expect(job.steps.find((step) => step.id === "assess")?.status).toBe(
    StepStatus.Skipped,
  );
  expect((await calls()).map((call) => call.tool)).toEqual(["claude"]);
});

test.each([
  {
    name: "failed turn",
    events: [{ type: "turn.failed", error: { message: "Synthetic failure" } }],
  },
  {
    name: "error event",
    events: [{ type: "error", message: "Synthetic error" }],
  },
  {
    name: "truncated stream",
    events: [{ type: "thread.started", thread_id: threadId }],
  },
  {
    name: "missing session",
    events: [
      { type: "item.completed", item: { type: "agent_message", text: "Done" } },
      { type: "turn.completed" },
    ],
  },
])("$name stops before fixes", async ({ events }) => {
  await writeEvents("assess", events);
  const job = await settled(start(RunMode.All).id);
  expect(job.status).toBe(JobStatus.Failed);
  expect(job.steps.at(-1)?.status).toBe(StepStatus.Skipped);
  expect((await calls()).map((call) => call.tool)).toEqual(["claude", "codex"]);
});

test("nonzero Codex exit fails even after a completed event", async () => {
  await Bun.write(join(fixture, "assess.exit"), "1");
  const job = await settled(start(RunMode.All).id);
  expect(job.error).toEndWith("/bin/codex exited 1");
  expect(job.steps.at(-1)?.status).toBe(StepStatus.Skipped);
});

test("human actions allow independent fixes but end as needs attention", async () => {
  for (const phase of ["assess", "apply"]) {
    await writeEvents(phase, [
      { type: "thread.started", thread_id: threadId },
      {
        type: "item.completed",
        item: {
          type: "agent_message",
          text: JSON.stringify({
            report:
              "Add the service credential in GitHub. Independent fixes are complete.",
            needs_attention: true,
            accepted_findings: 1,
          }),
        },
      },
      { type: "turn.completed" },
    ]);
  }
  const job = await settled(start(RunMode.All).id);
  expect(job.status).toBe(JobStatus.NeedsAttention);
  expect(job.steps.at(-1)?.status).toBe(StepStatus.NeedsAttention);
  expect(job.steps.at(-1)?.output).toContain("Add the service credential");
  expect(job.steps.find((step) => step.id === "draft")?.status).toBe(
    StepStatus.Succeeded,
  );
  expect((await calls()).map((call) => call.tool)).toEqual([
    "claude",
    "codex",
    "codex",
    "git",
  ]);
});

test("archive failure preserves scratch and prevents launching agents", async () => {
  const retained = join(fixture, ".scratch/review/previous.decisions.md");
  await Bun.write(retained, "Deferred synthetic finding");
  const stateFile = join(fixture, "not-a-directory");
  await Bun.write(stateFile, "blocked");
  process.env.XDG_STATE_HOME = stateFile;
  const job = await settled(start(RunMode.All).id);
  expect(job.status).toBe(JobStatus.Failed);
  expect(job.error).toContain("could not archive");
  expect(await Bun.file(retained).text()).toBe("Deferred synthetic finding");
  expect(await Bun.file(join(fixture, "calls.jsonl")).exists()).toBe(false);
});

async function cleanReports() {
  for (const phase of ["assess", "apply"]) {
    await writeEvents(phase, [
      { type: "thread.started", thread_id: threadId },
      {
        type: "item.completed",
        item: {
          type: "agent_message",
          text: JSON.stringify({
            report: "No accepted findings",
            needs_attention: false,
            accepted_findings: 0,
          }),
        },
      },
      { type: "turn.completed" },
    ]);
  }
}

test("a clean round pushes only the reviewed SHA with the captured remote lease", async () => {
  await cleanReports();
  const job = await settled(start(RunMode.All).id);
  expect(job.status).toBe(JobStatus.Succeeded);
  const pushed = (await calls()).filter((call) => call.tool === "git");
  expect(pushed).toHaveLength(2);
  expect(pushed[0]?.args).toContain(
    `--force-with-lease=${draftRef}:${"e".repeat(40)}`,
  );
  expect(pushed[0]?.args.at(-1)).toBe(`${head}:${draftRef}`);
  expect(pushed[1]?.args).toEqual([
    "push",
    "--porcelain",
    "--no-follow-tags",
    "--recurse-submodules=no",
    `--force-with-lease=refs/heads/main:${parent}`,
    "--",
    "origin",
    `${sha}:refs/heads/main`,
  ]);
  expect(job.steps.at(-1)?.output).toContain(`Pushed reviewed commit ${sha}`);
  const archive = join(
    fixture,
    "state/alliance/agentic-review",
    job.id,
    "push.json",
  );
  expect((await Bun.file(archive).json()).outcome.ok).toBe(true);
});

test("a remote change during review rejects the push using the original lease", async () => {
  await cleanReports();
  let job = await settled(start(RunMode.Step).id);
  remoteTip = "c".repeat(40);
  while (job.status === JobStatus.Paused) {
    R.unwrap(stepJob(job.id));
    job = await settled(job.id);
  }
  expect(job.status).toBe(JobStatus.Failed);
  expect(job.error).toBe("Remote branch changed; push rejected");
  expect((await calls()).at(-1)?.args).toContain(
    `--force-with-lease=refs/heads/main:${parent}`,
  );
});

test("rewriting the reviewed commit prevents pushing the stale review", async () => {
  await cleanReports();
  remainsOnBranch = false;
  const job = await settled(start(RunMode.All).id);
  expect(job.status).toBe(JobStatus.Failed);
  expect(job.error).toContain("no longer on this branch");
  expect(
    (await calls())
      .filter((call) => call.tool === "git")
      .map((call) => call.args.at(-1)),
  ).toEqual([`${head}:${draftRef}`]);
});

test("a merge commit cannot publish unreviewed ancestry", async () => {
  ancestry = `${sha} ${parent} ${"c".repeat(40)}`;
  const job = await settled(start(RunMode.All).id);
  expect(job.status).toBe(JobStatus.Failed);
  expect(job.error).toContain("only parent");
  expect(await Bun.file(join(fixture, "calls.jsonl")).exists()).toBe(false);
});

test("an absent accepted-finding count cannot authorize a push", async () => {
  await writeEvents("assess", [
    { type: "thread.started", thread_id: threadId },
    {
      type: "item.completed",
      item: {
        type: "agent_message",
        text: JSON.stringify({ report: "Done", needs_attention: false }),
      },
    },
    { type: "turn.completed" },
  ]);
  const job = await settled(start(RunMode.All).id);
  expect(job.status).toBe(JobStatus.Failed);
  expect(job.error).toContain("invalid Codex review report");
  expect((await calls()).some((call) => call.tool === "git")).toBe(false);
});

test("canceling a completed subprocess still prevents later publication steps", async () => {
  let published = false;
  const started = R.unwrap(startJob({
    kind: JobKind.ReviewBase,
    label: "Synthetic cancellation",
    worktree: fixture,
    mode: RunMode.All,
    steps: [
      { id: "apply", title: "apply", command: "synthetic", outputFormat: StepOutputFormat.Text, run: async context => {
        R.unwrap(jobs.cancelJob(context.job.id));
        return R.success("Process already finished");
      } },
      { id: "push", title: "push", command: "synthetic", outputFormat: StepOutputFormat.Text, run: async () => {
        published = true;
        return R.success("Published");
      } },
    ],
  }));
  const job = await settled(started.id);
  expect(job.status).toBe(JobStatus.Canceled);
  expect(published).toBe(false);
});

test("raw output is saved before a running agent is canceled", async () => {
  await Bun.write(join(fixture, "assess.wait"), "wait");
  const job = start(RunMode.All);
  const log = Bun.file(
    join(
      fixture,
      "state/alliance/agentic-review",
      job.id,
      "assess.stdout.jsonl",
    ),
  );
  const expected = await Bun.file(join(fixture, "assess.jsonl")).text();
  for (let attempt = 0; attempt < 200; attempt++) {
    if ((await log.exists()) && (await log.text()) === expected) break;
    await Bun.sleep(10);
  }
  expect(await log.text()).toBe(expected);
  expect(snapshot().find((entry) => entry.id === job.id)?.status).toBe(
    JobStatus.Running,
  );
  R.unwrap(jobs.cancelJob(job.id));
  expect((await settled(job.id)).status).toBe(JobStatus.Canceled);
  expect(await log.text()).toBe(expected);
});

test("a new draft branch uses a lease requiring that it does not exist", async () => {
  draftRemoteTip = "";
  const job = await settled(start(RunMode.All).id);
  expect(job.status).toBe(JobStatus.Succeeded);
  const push = (await calls()).find((call) => call.tool === "git");
  expect(push?.args).toContain(`--force-with-lease=${draftRef}:`);
  expect(push?.args.slice(-2)).toEqual(["origin", `${head}:${draftRef}`]);
});

test("a draft changed during review prevents either remote from being overwritten", async () => {
  await cleanReports();
  let job = await settled(start(RunMode.Step).id);
  draftRemoteTip = "f".repeat(40);
  while (job.status === JobStatus.Paused) {
    R.unwrap(stepJob(job.id));
    job = await settled(job.id);
  }
  expect(job.status).toBe(JobStatus.Failed);
  expect(job.steps.at(-1)?.status).toBe(StepStatus.Skipped);
  const pushes = (await calls()).filter((call) => call.tool === "git");
  expect(pushes).toHaveLength(1);
  expect(pushes[0]?.args).toContain(
    `--force-with-lease=${draftRef}:${"e".repeat(40)}`,
  );
});

test("switching local branches during review prevents draft publication", async () => {
  let job = await settled(start(RunMode.Step).id);
  currentBranch = "different-feature";
  while (job.status === JobStatus.Paused) {
    R.unwrap(stepJob(job.id));
    job = await settled(job.id);
  }
  expect(job.status).toBe(JobStatus.Failed);
  expect(job.error).toContain("checked-out branch changed");
  expect((await calls()).some((call) => call.tool === "git")).toBe(false);
});

test("raw logs preserve malformed lines and stderr when the agent fails", async () => {
  const stdout =
    'not JSON\n{"type":"thread.started","thread_id":"synthetic"}\npartial';
  const stderr = "Synthetic diagnostic\nunterminated diagnostic";
  await Bun.write(join(fixture, "assess.jsonl"), stdout);
  await Bun.write(join(fixture, "assess.stderr"), stderr);
  await Bun.write(join(fixture, "assess.exit"), "1");
  const job = await settled(start(RunMode.All).id);
  expect(job.status).toBe(JobStatus.Failed);
  const archive = join(fixture, "state/alliance/agentic-review", job.id);
  expect(await Bun.file(join(archive, "assess.stdout.jsonl")).text()).toBe(
    stdout,
  );
  expect(await Bun.file(join(archive, "assess.stderr.log")).text()).toBe(
    stderr,
  );
});
