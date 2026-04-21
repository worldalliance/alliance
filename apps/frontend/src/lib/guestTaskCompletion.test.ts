import type {
  FormResponseDto,
  SubmitFormDto,
} from "@alliance/shared/client";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const memoryStorage = new MemoryStorage();

beforeAll(() => {
  (globalThis as unknown as { window?: unknown }).window = {
    localStorage: memoryStorage,
  };
});

afterEach(() => {
  memoryStorage.clear();
});

// Imported after window shim so top-level module init (if any) sees it.
const {
  getGuestTaskCompletion,
  saveGuestTaskCompletion,
  removeGuestTaskCompletion,
} = await import("./guestTaskCompletion");

const STORAGE_KEY = "alliance.guest-task-completions.v1";

const record = (actionId: number) => ({
  actionId,
  taskFormId: actionId * 10,
  submission: { actionId, answers: {} } as unknown as SubmitFormDto,
  formResponse: { id: actionId } as unknown as FormResponseDto,
  completedAt: "2026-04-20T00:00:00.000Z",
});

describe("guestTaskCompletion storage helpers", () => {
  it("saves and retrieves a record keyed by actionId", () => {
    saveGuestTaskCompletion(record(1));

    const retrieved = getGuestTaskCompletion(1);
    expect(retrieved?.actionId).toBe(1);
    expect(retrieved?.taskFormId).toBe(10);
  });

  it("returns null when no record exists for the actionId", () => {
    saveGuestTaskCompletion(record(1));
    expect(getGuestTaskCompletion(999)).toBeNull();
  });

  it("overwrites a prior record for the same action", () => {
    saveGuestTaskCompletion(record(1));
    saveGuestTaskCompletion({ ...record(1), completedAt: "2099-01-01" });

    expect(getGuestTaskCompletion(1)?.completedAt).toBe("2099-01-01");
  });

  it("preserves other records when one is removed", () => {
    saveGuestTaskCompletion(record(1));
    saveGuestTaskCompletion(record(2));

    removeGuestTaskCompletion(1);

    expect(getGuestTaskCompletion(1)).toBeNull();
    expect(getGuestTaskCompletion(2)?.actionId).toBe(2);
  });

  it("returns null when stored JSON is malformed", () => {
    memoryStorage.setItem(STORAGE_KEY, "{not-valid-json");
    expect(getGuestTaskCompletion(1)).toBeNull();
  });

  it("ignores non-object root values in storage", () => {
    memoryStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(getGuestTaskCompletion(1)).toBeNull();
  });
});
