import { isEqual } from "es-toolkit";

/**
 * Which edits a commit belongs to. Commits sharing a `task` (made before the
 * next microtask, so an `await` splits them), or a non-null `run`, fold into
 * one undo step when they follow each other.
 */
export type StepTag = { task: number; run: number | null };

export type DraftHistory<T> = {
  past: T[];
  present: T;
  future: T[];
  lastStep: StepTag | null;
};

export enum HistoryActionKind {
  Commit = "commit",
  Amend = "amend",
  EndStep = "endStep",
  Undo = "undo",
  Redo = "redo",
  Reset = "reset",
  MapAll = "mapAll",
}

export type HistoryAction<T> =
  | { kind: HistoryActionKind.Commit; update: (draft: T) => T; step: StepTag }
  /** Rewrites the present without adding a step. */
  | { kind: HistoryActionKind.Amend; update: (draft: T) => T }
  /** Makes the next commit start a step of its own. */
  | { kind: HistoryActionKind.EndStep }
  | { kind: HistoryActionKind.Undo }
  | { kind: HistoryActionKind.Redo }
  | { kind: HistoryActionKind.Reset; draft: T }
  /** Rewrites every entry, past and future included. */
  | { kind: HistoryActionKind.MapAll; map: (draft: T) => T };

export const startHistory = <T>(draft: T): DraftHistory<T> => ({
  past: [],
  present: draft,
  future: [],
  lastStep: null,
});

const continuesStep = (last: StepTag | null, step: StepTag) =>
  last !== null &&
  (last.task === step.task || (step.run !== null && last.run === step.run));

export function draftHistoryReducer<T>(
  state: DraftHistory<T>,
  action: HistoryAction<T>,
): DraftHistory<T> {
  switch (action.kind) {
    case HistoryActionKind.Commit: {
      const present = action.update(state.present);
      if (isEqual(present, state.present)) return state;
      return {
        past: continuesStep(state.lastStep, action.step)
          ? state.past
          : [...state.past, state.present],
        present,
        future: [],
        lastStep: action.step,
      };
    }
    case HistoryActionKind.Amend: {
      const present = action.update(state.present);
      return isEqual(present, state.present) ? state : { ...state, present };
    }
    case HistoryActionKind.EndStep:
      return state.lastStep === null ? state : { ...state, lastStep: null };
    case HistoryActionKind.Undo: {
      const previous = state.past.at(-1);
      if (previous === undefined) return state;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        lastStep: null,
      };
    }
    case HistoryActionKind.Redo: {
      const [next, ...future] = state.future;
      if (next === undefined) return state;
      return {
        past: [...state.past, state.present],
        present: next,
        future,
        lastStep: null,
      };
    }
    case HistoryActionKind.Reset:
      return startHistory(action.draft);
    case HistoryActionKind.MapAll:
      return {
        past: state.past.map(action.map),
        present: action.map(state.present),
        future: state.future.map(action.map),
        lastStep: state.lastStep,
      };
    default:
      throw new Error(`unknown history action: ${action satisfies never}`);
  }
}
