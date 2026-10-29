import { useEffect, useRef, useState } from "react";

export type FlowPositionStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type FlowPosition = {
  screenIndex: number | null;
  loaded: boolean;
  save: (screenIndex: number) => void;
  clear: () => void;
};

const storageKey = (taskFormId: number) => `taskflow-screen:${taskFormId}`;

/**
 * The flow screen a member last had open on this device, kept per form
 * version so an edited form never resumes on a screen that moved.
 * `storage` must be referentially stable.
 */
export function useFlowPosition(params: {
  taskFormId: number;
  formSnapshotId: number;
  storage: FlowPositionStorage;
}): FlowPosition {
  const { taskFormId, formSnapshotId, storage } = params;
  const [screenIndex, setScreenIndex] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  // A save or clear while the read is in flight is newer than what it reads.
  const changed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    changed.current = false;
    setScreenIndex(null);
    setLoaded(false);
    storage
      .getItem(storageKey(taskFormId))
      .then((raw) => {
        const [snapshot, screen] = (raw ?? "").split(":").map(Number);
        if (
          !cancelled &&
          !changed.current &&
          snapshot === formSnapshotId &&
          Number.isInteger(screen)
        ) {
          setScreenIndex(screen);
        }
      })
      .catch((e) => console.error("Failed to read task flow position", e))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [taskFormId, formSnapshotId, storage]);

  const save = (screen: number) => {
    changed.current = true;
    setScreenIndex(screen);
    storage
      .setItem(storageKey(taskFormId), `${formSnapshotId}:${screen}`)
      .catch((e) => console.error("Failed to save task flow position", e));
  };

  const clear = () => {
    changed.current = true;
    setScreenIndex(null);
    storage
      .removeItem(storageKey(taskFormId))
      .catch((e) => console.error("Failed to clear task flow position", e));
  };

  return { screenIndex, loaded, save, clear };
}
