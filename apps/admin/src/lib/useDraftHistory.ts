import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  draftHistoryReducer,
  HistoryActionKind,
  startHistory,
  type StepTag,
} from "./draftHistory";

const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "number",
  "password",
]);

/** Whether `element` takes typed text, whose undo belongs to the browser. */
export function isTextEntry(element: EventTarget | null): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

/**
 * An undoable draft. Commits made before the next microtask form one step, as
 * do commits typed into one text control while it keeps focus. A commit
 * outside an input or change event, such as an upload landing, isn't typing
 * even while a text control has focus.
 */
export function useDraftHistory<T>(initial: () => T) {
  const [history, dispatch] = useReducer(
    draftHistoryReducer<T>,
    undefined,
    () => startHistory(initial()),
  );

  const taskRef = useRef<number | null>(null);
  const nextTaskRef = useRef(0);
  const focusRunRef = useRef(0);
  // A commit is typing while an input or change event is mid-dispatch. Its
  // phase marks that; a flag cleared by a microtask can't, since a browser
  // drains microtasks between the listeners of a user's own event.
  const editEventRef = useRef<Event | null>(null);
  const amendingRef = useRef(false);
  useEffect(() => {
    const onFocusIn = () => {
      focusRunRef.current += 1;
    };
    const onEdit = (event: Event) => {
      editEventRef.current = event;
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
    };
  }, []);

  const currentStep = useCallback((): StepTag => {
    if (taskRef.current === null) {
      taskRef.current = nextTaskRef.current++;
      queueMicrotask(() => {
        taskRef.current = null;
      });
    }
    const editing =
      editEventRef.current !== null &&
      editEventRef.current.eventPhase !== Event.NONE;
    return {
      task: taskRef.current,
      run:
        editing && isTextEntry(document.activeElement)
          ? focusRunRef.current
          : null,
    };
  }, []);

  const actions = useMemo(
    () => ({
      commit: (update: (draft: T) => T) =>
        dispatch(
          amendingRef.current
            ? { kind: HistoryActionKind.Amend, update }
            : { kind: HistoryActionKind.Commit, update, step: currentStep() },
        ),
      /** Turns the commits `write` makes into amendments of the present. */
      withoutStep: (write: () => void) => {
        amendingRef.current = true;
        try {
          write();
        } finally {
          amendingRef.current = false;
        }
      },
      amend: (update: (draft: T) => T) =>
        dispatch({ kind: HistoryActionKind.Amend, update }),
      endStep: () => dispatch({ kind: HistoryActionKind.EndStep }),
      undo: () => dispatch({ kind: HistoryActionKind.Undo }),
      redo: () => dispatch({ kind: HistoryActionKind.Redo }),
      reset: (draft: T) => dispatch({ kind: HistoryActionKind.Reset, draft }),
      mapAll: (map: (draft: T) => T) =>
        dispatch({ kind: HistoryActionKind.MapAll, map }),
    }),
    [currentStep],
  );

  return {
    ...actions,
    draft: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
