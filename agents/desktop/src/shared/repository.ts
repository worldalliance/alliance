export enum RepositoryStatus {
  Checking = "checking",
  GitMissing = "git-missing",
  NotSetUp = "not-set-up",
  Cloning = "cloning",
  Ready = "ready",
  UpdateNeeded = "update-needed",
  Updating = "updating",
}

export enum ClonePhase {
  Preparing = "preparing",
  Downloading = "downloading",
  Unpacking = "unpacking",
  WritingFiles = "writing-files",
}

export enum UpdateBlockerKind {
  OnBranch = "on-branch",
  Detached = "detached",
  Uncommitted = "uncommitted",
}

/** Why an outdated copy can't be fast-forwarded by the app. */
export type UpdateBlocker =
  | { kind: UpdateBlockerKind.OnBranch; branch: string }
  | { kind: UpdateBlockerKind.Detached }
  | { kind: UpdateBlockerKind.Uncommitted };

/** What went wrong, in words, with git's own output, if any, as details. */
export type Problem = { message: string; details?: string };

export type RepositoryState =
  | { status: RepositoryStatus.Checking }
  | { status: RepositoryStatus.GitMissing; message: string }
  | {
      status: RepositoryStatus.NotSetUp;
      cloneFolder: string;
      problem?: Problem;
    }
  | {
      status: RepositoryStatus.Cloning;
      folder: string;
      phase: ClonePhase;
      percent?: number;
    }
  | { status: RepositoryStatus.Ready; folder: string }
  | {
      status: RepositoryStatus.UpdateNeeded;
      folder: string;
      blocker?: UpdateBlocker;
      problem?: Problem;
    }
  | { status: RepositoryStatus.Updating; folder: string };

/** The main checkout a conversation can run in, when there is one. */
export function repositoryFolder(state: RepositoryState): string | undefined {
  switch (state.status) {
    case RepositoryStatus.Ready:
    case RepositoryStatus.UpdateNeeded:
    case RepositoryStatus.Updating:
      return state.folder;
    case RepositoryStatus.Checking:
    case RepositoryStatus.GitMissing:
    case RepositoryStatus.NotSetUp:
    case RepositoryStatus.Cloning:
      return undefined;
    default:
      throw new Error(`unknown status: ${state satisfies never}`);
  }
}
