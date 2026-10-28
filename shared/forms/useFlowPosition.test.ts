import { act, renderHook, waitFor } from "@testing-library/react";
import { useFlowPosition, type FlowPositionStorage } from "./useFlowPosition";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  const storage: FlowPositionStorage = {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value);
    },
    removeItem: async (key) => {
      items.delete(key);
    },
  };
  return { items, storage };
}

describe("useFlowPosition", () => {
  it("restores the screen saved for the same form version", async () => {
    const { storage } = memoryStorage({ "taskflow-screen:7": "3:2" });
    const { result } = renderHook(() =>
      useFlowPosition({ taskFormId: 7, formSnapshotId: 3, storage }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.screenIndex).toBe(2);
  });

  it("ignores a screen saved for another form version", async () => {
    const { storage } = memoryStorage({ "taskflow-screen:7": "2:4" });
    const { result } = renderHook(() =>
      useFlowPosition({ taskFormId: 7, formSnapshotId: 3, storage }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.screenIndex).toBeNull();
  });

  it("forgets the previous form's screen when the form changes", async () => {
    const { storage } = memoryStorage({ "taskflow-screen:7": "3:2" });
    const { result, rerender } = renderHook(
      ({ taskFormId }) =>
        useFlowPosition({ taskFormId, formSnapshotId: 3, storage }),
      { initialProps: { taskFormId: 7 } },
    );
    await waitFor(() => expect(result.current.screenIndex).toBe(2));
    rerender({ taskFormId: 8 });
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.screenIndex).toBeNull();
  });

  it("keeps a screen saved while the stored one is still loading", async () => {
    let release: () => void = () => {};
    const { storage } = memoryStorage({ "taskflow-screen:7": "3:2" });
    const slow: FlowPositionStorage = {
      ...storage,
      getItem: (key) =>
        new Promise((resolve) => {
          release = () => void storage.getItem(key).then(resolve);
        }),
    };
    const { result } = renderHook(() =>
      useFlowPosition({ taskFormId: 7, formSnapshotId: 3, storage: slow }),
    );
    act(() => result.current.save(5));
    act(() => release());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.screenIndex).toBe(5);
  });

  it("saves and clears the position", async () => {
    const { items, storage } = memoryStorage();
    const { result } = renderHook(() =>
      useFlowPosition({ taskFormId: 7, formSnapshotId: 3, storage }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.save(5));
    expect(result.current.screenIndex).toBe(5);
    await waitFor(() => expect(items.get("taskflow-screen:7")).toBe("3:5"));
    act(() => result.current.clear());
    expect(result.current.screenIndex).toBeNull();
    await waitFor(() => expect(items.has("taskflow-screen:7")).toBe(false));
  });
});
