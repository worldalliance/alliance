import { R, type Result } from "@alliance/common/result";
import type { Subprocess } from "bun";
import {
  JobStatus,
  RunMode,
  StepStatus,
  type Job,
  type JobKind,
  type JobStep,
  type StepOutputFormat,
} from "./types";

type JobRecord = Job & {
  lock: string;
  proc: Subprocess | null;
  canceled: boolean;
};

export type StepContext = {
  job: JobRecord;
  step: JobStep;
  outputs: Map<string, string>;
};

export type StepDefinition = {
  id: string;
  title: string;
  command: string;
  outputFormat: StepOutputFormat;
  run: (context: StepContext) => Promise<Result<string | null, string>>;
};

export const REPO_LOCK = "repo";

/** A paused job holds its worktree, so nothing else may start there. */
const ACTIVE: Record<JobStatus, boolean> = {
  [JobStatus.Running]: true,
  [JobStatus.Paused]: true,
  [JobStatus.Succeeded]: false,
  [JobStatus.Failed]: false,
  [JobStatus.Canceled]: false,
};

export function toSteps(definitions: StepDefinition[]): JobStep[] {
  return definitions.map((definition) => ({
    id: definition.id,
    title: definition.title,
    command: definition.command,
    status: StepStatus.Pending,
    startedAt: null,
    endedAt: null,
    log: [],
    output: null,
    outputFormat: definition.outputFormat,
    messageCount: 0,
    error: null,
  }));
}

const jobs = new Map<string, JobRecord>();

type Runnable = {
  definitions: StepDefinition[];
  outputs: Map<string, string>;
};

const runnable = new Map<string, Runnable>();

/** Whole agent transcripts, kept out of the job snapshot the page polls. */
const transcripts = new Map<string, unknown[]>();

function transcriptKey(params: { jobId: string; stepId: string }): string {
  return `${params.jobId}:${params.stepId}`;
}

export function appendMessage(params: {
  context: StepContext;
  message: unknown;
}): void {
  const { job, step } = params.context;
  const key = transcriptKey({ jobId: job.id, stepId: step.id });

  const messages = transcripts.get(key) ?? [];
  messages.push(params.message);
  transcripts.set(key, messages);
  step.messageCount = messages.length;
}

export function stepMessages(params: {
  jobId: string;
  stepId: string;
}): unknown[] | null {
  return transcripts.get(transcriptKey(params)) ?? null;
}

export function snapshot(): Job[] {
  return [...jobs.values()]
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(({ lock: _lock, proc: _proc, canceled: _canceled, ...job }) => job);
}

export function hasActiveJob(lock: string): boolean {
  return [...jobs.values()].some(
    (job) => job.lock === lock && ACTIVE[job.status],
  );
}

export function appendLog(step: JobStep, line: string): void {
  step.log.push(line);
}

async function drain(params: {
  stream: ReadableStream<Uint8Array>;
  onLine?: (line: string) => void;
}): Promise<string> {
  const reader = params.stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let pending = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    const decoded = decoder.decode(value, { stream: true });
    text += decoded;
    if (!params.onLine) continue;

    pending += decoded;
    const complete = pending.split("\n");
    pending = complete.pop() ?? "";
    for (const line of complete) params.onLine(line);
  }

  if (params.onLine && pending) params.onLine(pending);
  return text;
}

export async function spawnLogged(params: {
  context: StepContext;
  command: string[];
  cwd: string;
  onStdout?: (line: string) => void;
}): Promise<Result<string, string>> {
  const { job, step } = params.context;
  step.command = params.command.join(" ");

  const spawned = R.fromThrowable(() =>
    Bun.spawn(params.command, {
      cwd: params.cwd,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    }),
  );
  if (!spawned.ok) return R.failure(spawned.error.message);

  const proc = spawned.value;
  job.proc = proc;

  const [stdout, , exitCode] = await Promise.all([
    drain({ stream: proc.stdout, onLine: params.onStdout }),
    drain({ stream: proc.stderr, onLine: (line) => appendLog(step, line) }),
    proc.exited,
  ]);
  job.proc = null;

  return exitCode === 0
    ? R.success(stdout)
    : R.failure(`${params.command[0]} exited ${exitCode}`);
}

function finish(params: {
  job: JobRecord;
  step: JobStep;
  remaining: JobStep[];
  error: string;
}): void {
  const canceled = params.job.canceled;
  params.step.status = canceled ? StepStatus.Canceled : StepStatus.Failed;
  params.step.error = canceled ? "canceled" : params.error;

  for (const step of params.remaining) step.status = StepStatus.Skipped;

  params.job.status = canceled ? JobStatus.Canceled : JobStatus.Failed;
  params.job.error = params.step.error;
}

function nextStep(job: JobRecord): number {
  return job.steps.findIndex((step) => step.status === StepStatus.Pending);
}

function complete(job: JobRecord): void {
  job.status = JobStatus.Succeeded;
  job.endedAt = Date.now();
  runnable.delete(job.id);
}

async function runStep(job: JobRecord, index: number): Promise<boolean> {
  const pending = runnable.get(job.id);
  const definition = pending?.definitions[index];
  const step = job.steps[index];
  if (!pending || !definition || !step) return false;

  step.status = StepStatus.Running;
  step.startedAt = Date.now();

  const outcome = await R.fromPromiseFn(() =>
    definition.run({ job, step, outputs: pending.outputs }),
  );

  step.endedAt = Date.now();
  job.proc = null;

  const failure = outcome.ok
    ? R.match(outcome.value, {
        success: (output) => {
          step.status = StepStatus.Succeeded;
          step.output = output;
          pending.outputs.set(definition.id, output ?? "");
          return null;
        },
        failure: (error) => error,
      })
    : outcome.error.message;

  if (failure === null) return true;

  finish({
    job,
    step,
    remaining: job.steps.slice(index + 1),
    error: failure,
  });
  job.endedAt = Date.now();
  runnable.delete(job.id);

  return false;
}

async function runAll(job: JobRecord): Promise<void> {
  for (;;) {
    const index = nextStep(job);
    if (index === -1) return complete(job);
    if (!(await runStep(job, index))) return;
  }
}

export function startJob(params: {
  kind: JobKind;
  label: string;
  worktree: string | null;
  steps: StepDefinition[];
  mode: RunMode;
}): Result<Job, string> {
  const lock = params.worktree ?? REPO_LOCK;
  const active = [...jobs.values()].find(
    (job) => job.lock === lock && ACTIVE[job.status],
  );
  if (active) return R.failure(`${active.label} is still running`);

  const job: JobRecord = {
    id: crypto.randomUUID(),
    kind: params.kind,
    status: JobStatus.Running,
    label: params.label,
    worktree: params.worktree,
    startedAt: Date.now(),
    endedAt: null,
    steps: toSteps(params.steps),
    baseSha: null,
    error: null,
    lock,
    proc: null,
    canceled: false,
  };

  jobs.set(job.id, job);
  runnable.set(job.id, { definitions: params.steps, outputs: new Map() });

  if (params.mode === RunMode.All) void runAll(job);
  else void advance(job);

  const { lock: _lock, proc: _proc, canceled: _canceled, ...created } = job;
  return R.success(created);
}

async function advance(job: JobRecord): Promise<void> {
  const index = nextStep(job);
  if (index === -1) return complete(job);

  job.status = JobStatus.Running;
  if (!(await runStep(job, index))) return;

  if (nextStep(job) === -1) complete(job);
  else job.status = JobStatus.Paused;
}

export function stepJob(id: string): Result<Job, string> {
  const job = jobs.get(id);
  if (!job) return R.failure(`no job ${id}`);
  if (job.status !== JobStatus.Paused) {
    return R.failure(`job ${id} is ${job.status}, not paused`);
  }

  void advance(job);

  const { lock: _lock, proc: _proc, canceled: _canceled, ...stepped } = job;
  return R.success(stepped);
}

export function cancelJob(id: string): Result<null, string> {
  const job = jobs.get(id);
  if (!job) return R.failure(`no job ${id}`);
  if (!ACTIVE[job.status]) return R.failure(`job ${id} already ${job.status}`);

  job.canceled = true;

  if (job.status === JobStatus.Paused) {
    for (const step of job.steps) {
      if (step.status === StepStatus.Pending) step.status = StepStatus.Skipped;
    }
    job.status = JobStatus.Canceled;
    job.endedAt = Date.now();
    runnable.delete(job.id);
    return R.success(null);
  }

  job.proc?.kill();

  return R.success(null);
}
