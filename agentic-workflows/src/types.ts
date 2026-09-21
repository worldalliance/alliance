export enum JobKind {
  NewWorktree = "new-worktree",
  RemoveWorktree = "remove-worktree",
  ReviewBase = "review-base",
}

export enum JobStatus {
  Running = "running",
  Paused = "paused",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
}

export enum RunMode {
  All = "all",
  Step = "step",
}

export enum StepStatus {
  Pending = "pending",
  Running = "running",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
  Skipped = "skipped",
}

export enum StepOutputFormat {
  Text = "text",
  Markdown = "markdown",
}

export type JobStep = {
  id: string;
  title: string;
  command: string;
  status: StepStatus;
  startedAt: number | null;
  endedAt: number | null;
  log: string[];
  output: string | null;
  outputFormat: StepOutputFormat;
  messageCount: number;
  error: string | null;
};

export type Job = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  label: string;
  worktree: string | null;
  startedAt: number;
  endedAt: number | null;
  steps: JobStep[];
  baseSha: string | null;
  error: string | null;
};

export type WorktreePorts = {
  server: number;
  frontend: number;
  admin: number;
  mobile: number;
  database: string;
  testDatabase: string;
};

export type WorktreeSummary = {
  path: string;
  name: string;
  branch: string | null;
  head: string;
  isMain: boolean;
  isPanel: boolean;
  ports: WorktreePorts | null;
};

export type FileChange = {
  code: string;
  path: string;
};

export type Commit = {
  sha: string;
  refs: string[];
  subject: string;
  added: number;
  removed: number;
};

export type WorktreeDetail = {
  path: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  changes: FileChange[];
  base: string;
  commitRange: string;
  commits: Commit[];
  baseCommits: Commit[];
  githubUrl: string | null;
  remoteBranches: string[];
};

export type PanelState = {
  worktrees: WorktreeSummary[];
  jobs: Job[];
};

export enum DiffLineKind {
  Context = "context",
  Added = "added",
  Removed = "removed",
}

export type DiffLine = {
  kind: DiffLineKind;
  oldNumber: number | null;
  newNumber: number | null;
  text: string;
};

export type DiffHunk = {
  header: string;
  lines: DiffLine[];
};

export type DiffFile = {
  oldPath: string | null;
  newPath: string | null;
  binary: boolean;
  hunks: DiffHunk[];
  added: number;
  removed: number;
};

export type CommitDiff = {
  base: string;
  head: string;
  files: DiffFile[];
  added: number;
  removed: number;
};
