import { useEffect, useState } from "react";
import {
  ClonePhase,
  type RepositoryState,
  RepositoryStatus,
  type UpdateBlocker,
  UpdateBlockerKind,
} from "../../shared/repository";
import { agent } from "./agent";

export type ShownRepository = {
  /** Undefined until the main process answers. */
  state?: RepositoryState;
  problem?: string;
};

export function useRepository(): ShownRepository {
  const [shown, setShown] = useState<ShownRepository>({});
  useEffect(() => {
    let changed = false;
    const unsubscribe = agent.onRepositoryChanged((state) => {
      changed = true;
      setShown({ state });
    });
    void agent.repositoryState().then((read) => {
      if (changed) return;
      setShown(read.ok ? { state: read.value } : { problem: read.error });
    });
    return unsubscribe;
  }, []);
  return shown;
}

const phaseWords: Record<ClonePhase, string> = {
  [ClonePhase.Preparing]: "Preparing",
  [ClonePhase.Downloading]: "Downloading",
  [ClonePhase.Unpacking]: "Unpacking",
  [ClonePhase.WritingFiles]: "Writing files",
};

export const clonePhaseWords = (phase: ClonePhase): string =>
  `${phaseWords[phase]}…`;

export const cloneProgressWords = (
  state: RepositoryState & { status: RepositoryStatus.Cloning },
): string =>
  state.percent === undefined
    ? clonePhaseWords(state.phase)
    : `${phaseWords[state.phase]}, ${state.percent}%`;

/** The state in a few words, for the sidebar. */
export function statusWords(shown: ShownRepository): string {
  const { state } = shown;
  if (!state) return shown.problem ? "Couldn't check" : "Checking…";
  switch (state.status) {
    case RepositoryStatus.Checking:
      return "Checking…";
    case RepositoryStatus.GitMissing:
      return "Needs Git";
    case RepositoryStatus.NotSetUp:
      return state.problem ? "Needs attention" : "Not cloned";
    case RepositoryStatus.Cloning:
      return `Cloning: ${cloneProgressWords(state)}`;
    case RepositoryStatus.Ready:
      return "Ready";
    case RepositoryStatus.UpdateNeeded:
      return "Update needed";
    case RepositoryStatus.Updating:
      return "Updating…";
    default:
      throw new Error(`unknown status: ${state satisfies never}`);
  }
}

export function blockerWords(blocker: UpdateBlocker): string {
  switch (blocker.kind) {
    case UpdateBlockerKind.OnBranch:
      return `This copy is on the branch ${blocker.branch}. Switch it to main, then check again.`;
    case UpdateBlockerKind.Detached:
      return "This copy isn't on a branch. Switch it to main, then check again.";
    case UpdateBlockerKind.Uncommitted:
      return "This copy's main has uncommitted changes. Commit them or set them aside, then check again.";
    default:
      throw new Error(`unknown blocker: ${blocker satisfies never}`);
  }
}
