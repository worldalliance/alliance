import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CirclePause,
  CircleSlash,
  CircleX,
  ExternalLink,
  GitBranch,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Square,
  StepForward,
  Trash2,
  X,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Markdown from "react-markdown";
import {
  DiffLineKind,
  JobStatus,
  RunMode,
  StepOutputFormat,
  StepStatus,
  type Commit,
  type DiffFile,
  type Job,
  type JobStep,
  type WorktreeDetail,
  type WorktreeSummary,
} from "../src/types";
import { api } from "./api";
import { Transcript } from "./transcript";

const STATUS_ICON: Record<JobStatus, ReactNode> = {
  [JobStatus.Running]: <Loader2 className="spin" size={14} />,
  [JobStatus.Paused]: <CirclePause className="muted" size={14} />,
  [JobStatus.Succeeded]: <CircleCheck className="ok" size={14} />,
  [JobStatus.Failed]: <CircleX className="bad" size={14} />,
  [JobStatus.Canceled]: <CircleSlash className="muted" size={14} />,
};

const LINE_CLASS: Record<DiffLineKind, string> = {
  [DiffLineKind.Context]: "context",
  [DiffLineKind.Added]: "added",
  [DiffLineKind.Removed]: "removed",
};

const LINE_MARK: Record<DiffLineKind, string> = {
  [DiffLineKind.Context]: " ",
  [DiffLineKind.Added]: "+",
  [DiffLineKind.Removed]: "-",
};

type CommitRange = { anchor: string; focus: string };

function commitSelection(params: {
  commits: Commit[];
  range: CommitRange | null;
}): { shas: string[]; oldest: string; newest: string } | null {
  if (!params.range) return null;

  const shas = params.commits.map((commit) => commit.sha);
  const anchor = shas.indexOf(params.range.anchor);
  const focus = shas.indexOf(params.range.focus);
  if (anchor === -1 || focus === -1) return null;

  const [first, last] = anchor <= focus ? [anchor, focus] : [focus, anchor];
  return {
    shas: shas.slice(first, last + 1),
    newest: shas[first],
    oldest: shas[last],
  };
}

const STEP_ICON: Record<StepStatus, ReactNode> = {
  [StepStatus.Pending]: <CircleDashed className="muted" size={14} />,
  [StepStatus.Running]: <Loader2 className="spin" size={14} />,
  [StepStatus.Succeeded]: <CircleCheck className="ok" size={14} />,
  [StepStatus.Failed]: <CircleX className="bad" size={14} />,
  [StepStatus.Canceled]: <CircleSlash className="muted" size={14} />,
  [StepStatus.Skipped]: <CircleMinus className="muted" size={14} />,
};

const STEP_OUTPUT: Record<StepOutputFormat, (output: string) => ReactNode> = {
  [StepOutputFormat.Text]: (output) => <pre className="log">{output}</pre>,
  [StepOutputFormat.Markdown]: (output) => (
    <div className="markdown">
      <Markdown>{output}</Markdown>
    </div>
  ),
};

function duration(params: { from: number; to: number | null }): string {
  const seconds = Math.round(((params.to ?? Date.now()) - params.from) / 1000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function elapsed(job: Job): string {
  return duration({ from: job.startedAt, to: job.endedAt });
}

const STEP_RAN: Record<StepStatus, boolean> = {
  [StepStatus.Pending]: false,
  [StepStatus.Running]: true,
  [StepStatus.Succeeded]: true,
  [StepStatus.Failed]: true,
  [StepStatus.Canceled]: true,
  [StepStatus.Skipped]: false,
};

function activeStep(steps: JobStep[]): JobStep | null {
  return (
    steps.find((step) => step.status === StepStatus.Running) ??
    [...steps].reverse().find((step) => STEP_RAN[step.status]) ??
    steps[0] ??
    null
  );
}

export function App() {
  const queryClient = useQueryClient();
  const state = useQuery({
    queryKey: ["state"],
    queryFn: api.state,
    refetchInterval: 1500,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const worktrees = state.data?.worktrees ?? [];
  const jobs = state.data?.jobs ?? [];

  useEffect(() => {
    if (worktrees.length === 0) return;
    if (!worktrees.some((worktree) => worktree.path === selected)) {
      setSelected(worktrees[0]?.path ?? null);
    }
  }, [worktrees, selected]);

  const repoJob = jobs.find((job) => job.worktree === null) ?? null;
  const current =
    worktrees.find((worktree) => worktree.path === selected) ?? null;

  return (
    <div className="app">
      <header>
        <h1>agentic workflows</h1>
        <NewWorktreeForm busy={repoJob?.status === JobStatus.Running} />
        <button
          className="icon"
          onClick={() => queryClient.invalidateQueries()}
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </header>

      {state.error && <p className="error">{state.error.message}</p>}
      {repoJob && <JobFlow job={repoJob} />}

      <div className="columns">
        <aside>
          <ul className="worktrees">
            {worktrees.map((worktree) => (
              <WorktreeRow
                key={worktree.path}
                worktree={worktree}
                selected={worktree.path === selected}
                job={jobs.find((job) => job.worktree === worktree.path) ?? null}
                onSelect={() => setSelected(worktree.path)}
                removable={repoJob?.status !== JobStatus.Running}
              />
            ))}
          </ul>
        </aside>

        <main>
          {current && (
            <WorktreePanel
              key={current.path}
              worktree={current}
              job={jobs.find((job) => job.worktree === current.path) ?? null}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function NewWorktreeForm({ busy }: { busy: boolean }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");

  const create = useMutation({
    mutationFn: api.createWorktree,
    onSuccess: () => {
      setName("");
      setFrom("");
      void queryClient.invalidateQueries({ queryKey: ["state"] });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ name: name.trim(), from: from.trim() || null });
  };

  return (
    <form className="new-worktree" onSubmit={submit}>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="new worktree name"
        required
      />
      <input
        value={from}
        onChange={(event) => setFrom(event.target.value)}
        placeholder="from ref (HEAD)"
      />
      <button
        className="icon"
        type="submit"
        disabled={busy || create.isPending}
        aria-label="Create worktree"
        title="Create worktree"
      >
        <Plus size={14} />
      </button>
      {create.error && <span className="error">{create.error.message}</span>}
    </form>
  );
}

function WorktreeRow(props: {
  worktree: WorktreeSummary;
  selected: boolean;
  job: Job | null;
  removable: boolean;
  onSelect: () => void;
}) {
  const queryClient = useQueryClient();
  const { worktree } = props;

  const remove = useMutation({
    mutationFn: api.removeWorktree,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["state"] }),
  });

  const confirmRemove = () => {
    const databases = worktree.ports
      ? ` and drops the databases ${worktree.ports.database} and ${worktree.ports.testDatabase}`
      : "";
    if (confirm(`Delete ${worktree.path}${databases}?`)) {
      remove.mutate(worktree.path);
    }
  };

  return (
    <li className={props.selected ? "selected" : undefined}>
      <button className="worktree" onClick={props.onSelect}>
        <span className="name">{worktree.name}</span>
        <span className="branch">
          <GitBranch size={12} />
          {worktree.branch ?? worktree.head.slice(0, 7)}
        </span>
        {props.job?.status === JobStatus.Running && (
          <Loader2 className="spin" size={14} />
        )}
      </button>
      {!worktree.isMain && !worktree.isPanel && (
        <button
          className="icon danger"
          onClick={confirmRemove}
          disabled={!props.removable || remove.isPending}
          aria-label={`Remove worktree ${worktree.name}`}
          title="Remove this worktree and drop its databases"
        >
          <Trash2 size={14} />
        </button>
      )}
      {remove.error && <span className="error">{remove.error.message}</span>}
    </li>
  );
}

function useStoredBase(path: string) {
  const key = `agentic-workflows:base:${path}`;
  const [base, setBase] = useState(() => localStorage.getItem(key) ?? "");

  return [
    base,
    (value: string) => {
      setBase(value);
      localStorage.setItem(key, value);
    },
  ] as const;
}

function WorktreePanel(props: { worktree: WorktreeSummary; job: Job | null }) {
  const { worktree } = props;
  const [base, setBase] = useStoredBase(worktree.path);

  const detail = useQuery({
    queryKey: ["worktree", worktree.path, base],
    queryFn: () => api.detail({ path: worktree.path, base }),
    refetchInterval: 4000,
  });

  const [range, setRange] = useState<CommitRange | null>(null);
  const rows = detail.data
    ? [...detail.data.commits, ...detail.data.baseCommits]
    : [];
  const selection = commitSelection({ commits: rows, range });

  const select = (sha: string, extend: boolean) => {
    setRange((current) => {
      if (extend && current) return { ...current, focus: sha };
      if (current?.anchor === sha && current.focus === sha) return null;
      return { anchor: sha, focus: sha };
    });
  };

  return (
    <>
      <section className="panel-head">
        <h2>{worktree.name}</h2>
        <span className="branch">
          <GitBranch size={12} />
          {worktree.branch ?? worktree.head.slice(0, 7)}
        </span>
        {detail.data?.githubUrl && detail.data.upstream ? (
          <a
            className="branch"
            href={detail.data.githubUrl}
            target="_blank"
            rel="noreferrer"
            title="Open the upstream branch on GitHub"
          >
            {detail.data.upstream}
            <ExternalLink size={12} />
          </a>
        ) : (
          <span className="branch muted">no upstream</span>
        )}
        {detail.data && (
          <label className="base-pick">
            base
            <select
              value={detail.data.base}
              onChange={(event) => setBase(event.target.value)}
              aria-label="Commit range base"
            >
              {detail.data.remoteBranches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </label>
        )}
        {worktree.ports && (
          <span className="ports">
            <a
              href={`http://localhost:${worktree.ports.frontend}`}
              target="_blank"
              rel="noreferrer"
            >
              frontend {worktree.ports.frontend}
            </a>
            <a
              href={`http://localhost:${worktree.ports.admin}`}
              target="_blank"
              rel="noreferrer"
            >
              admin {worktree.ports.admin}
            </a>
            <span>server {worktree.ports.server}</span>
            <span>{worktree.ports.database}</span>
          </span>
        )}
        <code className="path">{worktree.path}</code>
      </section>

      <ReviewBaseWorkflow
        worktree={worktree}
        job={props.job}
        remote={detail.data?.base ?? ""}
      />

      {detail.error && <p className="error">{detail.error.message}</p>}
      {detail.data && (
        <GitState
          detail={detail.data}
          rows={rows}
          baseSha={props.job?.baseSha ?? null}
          selected={selection?.shas ?? []}
          onSelect={select}
          onPickBase={setBase}
        />
      )}
      {selection && (
        <DiffView
          path={worktree.path}
          oldest={selection.oldest}
          newest={selection.newest}
          commits={selection.shas.length}
        />
      )}
    </>
  );
}

function GitState(props: {
  detail: WorktreeDetail;
  rows: Commit[];
  baseSha: string | null;
  selected: string[];
  onSelect: (sha: string, extend: boolean) => void;
  onPickBase: (base: string) => void;
}) {
  const { detail } = props;
  const remoteBranches = new Set(detail.remoteBranches);
  const baseShas = new Set(detail.baseCommits.map((commit) => commit.sha));

  return (
    <div className="git-state">
      <section>
        <h3>
          status
          <span className="muted">
            {detail.upstream ?? "no upstream"} · {detail.ahead} ahead ·{" "}
            {detail.behind} behind
          </span>
        </h3>
        {detail.changes.length === 0 ? (
          <p className="muted">clean</p>
        ) : (
          <ul className="changes">
            {detail.changes.map((change) => (
              <li key={change.path}>
                <code>{change.code}</code> {change.path}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>
          commits
          <span className="muted">
            {detail.commitRange} · click for its diff, shift-click for a range
          </span>
        </h3>
        {props.rows.length === 0 ? (
          <p className="muted">none</p>
        ) : (
          <ul className="commits">
            {props.rows.map((commit) => (
              <li
                key={commit.sha}
                className={[
                  props.baseSha?.startsWith(commit.sha) ? "base" : "",
                  props.selected.includes(commit.sha) ? "selected" : "",
                  baseShas.has(commit.sha) ? "range-base" : "",
                ]
                  .join(" ")
                  .trim()}
              >
                <button
                  className="commit"
                  onClick={(event) =>
                    props.onSelect(commit.sha, event.shiftKey)
                  }
                >
                  <code>{commit.sha}</code> {commit.subject}
                </button>
                <span className="stat">
                  <span className="add">+{commit.added}</span>
                  <span className="del">-{commit.removed}</span>
                </span>
                {commit.refs.map((ref) =>
                  remoteBranches.has(ref) ? (
                    <button
                      key={ref}
                      className="ref remote"
                      onClick={() => props.onPickBase(ref)}
                      title={`Review the commit after ${ref}`}
                    >
                      {ref}
                    </button>
                  ) : (
                    <span
                      key={ref}
                      className={ref === "HEAD" ? "ref head" : "ref"}
                    >
                      {ref}
                    </span>
                  ),
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReviewBaseWorkflow(props: {
  worktree: WorktreeSummary;
  job: Job | null;
  remote: string;
}) {
  const queryClient = useQueryClient();
  const { remote } = props;

  const start = useMutation({
    mutationFn: api.reviewBase,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["state"] }),
  });

  const running = props.job?.status === JobStatus.Running;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    start.mutate({ path: props.worktree.path, remote, mode: RunMode.All });
  };

  return (
    <form className="workflow" onSubmit={submit}>
      <h3>
        review base
        <button
          className="icon"
          type="submit"
          disabled={running || start.isPending || remote.length === 0}
          aria-label="Run review"
          title="Run review"
        >
          <Play size={14} />
        </button>
      </h3>
      <p className="muted">
        the commit after <code>{remote || "the base"}</code>, reviewed by{" "}
        <code>claude -p /review-base</code>
      </p>
      {start.error && <span className="error">{start.error.message}</span>}

      {props.job ? (
        <JobFlow job={props.job} />
      ) : (
        <WorkflowPreview
          path={props.worktree.path}
          remote={remote}
          running={start.isPending}
          onRunStep={() =>
            start.mutate({
              path: props.worktree.path,
              remote,
              mode: RunMode.Step,
            })
          }
        />
      )}
    </form>
  );
}

function WorkflowPreview(props: {
  path: string;
  remote: string;
  onRunStep: () => void;
  running: boolean;
}) {
  const preview = useQuery({
    queryKey: ["workflow", props.path, props.remote],
    queryFn: () => api.workflow({ path: props.path, remote: props.remote }),
    enabled: props.remote.length > 0,
    staleTime: Infinity,
  });

  if (!preview.data) return null;

  return (
    <StepNodes
      steps={preview.data}
      jobId={null}
      shownId={null}
      runnableId={preview.data[0]?.id ?? null}
      onRunStep={props.onRunStep}
      running={props.running}
    />
  );
}

function JobFlow({ job }: { job: Job }) {
  const queryClient = useQueryClient();
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ["state"] });

  const cancel = useMutation({ mutationFn: api.cancelJob, onSuccess: refresh });
  const step = useMutation({ mutationFn: api.stepJob, onSuccess: refresh });

  const shown = activeStep(job.steps);
  const paused = job.status === JobStatus.Paused;
  const runnable = paused
    ? (job.steps.find((entry) => entry.status === StepStatus.Pending)?.id ??
      null)
    : null;

  return (
    <section className="job">
      <h3>
        {STATUS_ICON[job.status]}
        {job.label}
        <span className="muted">{elapsed(job)}</span>
        {(job.status === JobStatus.Running || paused) && (
          <button
            className="icon danger"
            onClick={() => cancel.mutate(job.id)}
            aria-label="Stop this job"
            title="Stop this job"
          >
            <Square size={12} />
          </button>
        )}
      </h3>

      <StepNodes
        steps={job.steps}
        jobId={job.id}
        shownId={shown?.id ?? null}
        runnableId={runnable}
        onRunStep={() => step.mutate(job.id)}
        running={step.isPending}
      />

      {shown && <StepDetail step={shown} />}
    </section>
  );
}

function StepNodes(props: {
  steps: JobStep[];
  jobId: string | null;
  shownId: string | null;
  runnableId: string | null;
  onRunStep: () => void;
  running: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = props.steps.find((step) => step.id === openId) ?? null;

  return (
    <div className="flow">
      {props.steps.map((step, index) => (
        <Fragment key={step.id}>
          {index > 0 && <ArrowRight className="flow-arrow" size={16} />}
          <div className="node-wrap">
            <button
              type="button"
              className={`node ${step.id === props.shownId ? "shown" : ""}`}
              onClick={() => setOpenId(step.id)}
              title="Open this step"
            >
              <span className="node-head">
                {STEP_ICON[step.status]}
                {step.title}
                <span className="muted">
                  {step.startedAt
                    ? duration({ from: step.startedAt, to: step.endedAt })
                    : ""}
                </span>
              </span>
              <code>{step.command}</code>
            </button>
            {step.id === props.runnableId && (
              <button
                type="button"
                className="icon step-run"
                onClick={props.onRunStep}
                disabled={props.running}
                aria-label="Run this step and pause"
                title="Run this step and pause"
              >
                <StepForward size={12} />
              </button>
            )}
          </div>
        </Fragment>
      ))}

      {open && (
        <StepModal
          step={open}
          jobId={props.jobId}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function StepModal(props: {
  step: JobStep;
  jobId: string | null;
  onClose: () => void;
}) {
  const { step } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [transcript, setTranscript] = useState(true);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const live = step.status === StepStatus.Running;
  const messages = useQuery({
    queryKey: ["messages", props.jobId, step.id],
    queryFn: () => api.messages({ job: props.jobId ?? "", step: step.id }),
    enabled: transcript && props.jobId !== null && step.messageCount > 0,
    refetchInterval: live ? 1500 : false,
    staleTime: live ? 0 : Infinity,
  });

  return (
    <dialog
      className="modal"
      ref={dialogRef}
      onClose={props.onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current.close();
      }}
    >
      <header>
        {STEP_ICON[step.status]}
        <h4>{step.title}</h4>
        <span className="muted">
          {step.startedAt
            ? duration({ from: step.startedAt, to: step.endedAt })
            : "not run yet"}
        </span>
        <button
          className="icon"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close"
          title="Close"
        >
          <X size={14} />
        </button>
      </header>

      <div className="modal-body">
        <h5>command</h5>
        <pre className="command">{step.command}</pre>

        {step.error && <p className="error">{step.error}</p>}

        {step.log.length > 0 && (
          <>
            <h5>log</h5>
            <pre className="log">{step.log.join("\n")}</pre>
          </>
        )}

        {step.messageCount > 0 && (
          <>
            <h5>
              claude messages
              <button
                className="icon"
                onClick={() => setTranscript(!transcript)}
                aria-label="Show the claude messages"
                title="Show the claude messages"
              >
                {transcript ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
              </button>
              <span className="muted">{step.messageCount}</span>
            </h5>
            {transcript &&
              (messages.data ? (
                <Transcript messages={messages.data} />
              ) : (
                <p className="muted">loading</p>
              ))}
          </>
        )}

        {step.output && (
          <>
            <h5>output</h5>
            {STEP_OUTPUT[step.outputFormat](step.output)}
          </>
        )}
      </div>
    </dialog>
  );
}

function StepDetail({ step }: { step: JobStep }) {
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [step.log.length]);

  return (
    <div className="step-detail">
      {step.log.length > 0 && (
        <pre className="log" ref={logRef}>
          {step.log.join("\n")}
        </pre>
      )}
      {step.error && <p className="error">{step.error}</p>}
      {step.output && STEP_OUTPUT[step.outputFormat](step.output)}
      {step.log.length === 0 && !step.output && !step.error && (
        <p className="muted">no output yet</p>
      )}
    </div>
  );
}

function DiffView(props: {
  path: string;
  oldest: string;
  newest: string;
  commits: number;
}) {
  const diff = useQuery({
    queryKey: ["diff", props.path, props.oldest, props.newest],
    queryFn: () =>
      api.diff({
        path: props.path,
        oldest: props.oldest,
        newest: props.newest,
      }),
    staleTime: Infinity,
  });

  if (diff.error) return <p className="error">{diff.error.message}</p>;
  if (!diff.data) return <p className="muted">loading diff</p>;

  return (
    <section className="diff">
      <h3>
        {diff.data.files.length} changed
        <span className="add">+{diff.data.added}</span>
        <span className="del">-{diff.data.removed}</span>
        <span className="muted">
          {props.commits === 1
            ? props.newest
            : `${props.commits} commits, ${props.oldest}..${props.newest}`}
        </span>
      </h3>
      {diff.data.files.map((file) => (
        <DiffFileView key={file.newPath ?? file.oldPath} file={file} />
      ))}
    </section>
  );
}

function DiffFileView({ file }: { file: DiffFile }) {
  const [open, setOpen] = useState(true);
  const renamed = file.oldPath && file.newPath && file.oldPath !== file.newPath;

  return (
    <div className="diff-file">
      <button className="diff-head" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <code>
          {renamed
            ? `${file.oldPath} -> ${file.newPath}`
            : (file.newPath ?? file.oldPath)}
        </code>
        <span className="add">+{file.added}</span>
        <span className="del">-{file.removed}</span>
      </button>

      {open &&
        (file.binary ? (
          <p className="muted">binary file</p>
        ) : (
          <table className="diff-lines">
            {file.hunks.map((hunk) => (
              <tbody key={hunk.header}>
                <tr className="hunk">
                  <td colSpan={3}>{hunk.header}</td>
                </tr>
                {hunk.lines.map((line, index) => (
                  <tr key={index} className={LINE_CLASS[line.kind]}>
                    <td className="num">{line.oldNumber}</td>
                    <td className="num">{line.newNumber}</td>
                    <td className="code">
                      {LINE_MARK[line.kind]}
                      {line.text}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        ))}
    </div>
  );
}
