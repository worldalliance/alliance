import { UnrenderableSubject } from "@alliance/shared/forms/unrenderable";
import { afterEach, describe, expect, it, jest, setSystemTime } from "bun:test";
import { UPDATE_RECHECK_INTERVAL_MS } from "../lib/updateRechecks";
import { UpdateSearchOutcome } from "../lib/updateSearch";
import { RESTART_FAILED_MESSAGE } from "./updateCopy";
import {
  afterRecheck,
  rechecksForUpdate,
  RecoveryAction,
  startNoticeRechecks,
  startNoticeSearch,
  updateRecoveryView,
} from "./updateRecoveryView";

const view = (
  overrides: Partial<Parameters<typeof updateRecoveryView>[0]> = {},
) =>
  updateRecoveryView({
    subject: UnrenderableSubject.Form,
    ready: false,
    restartFailed: false,
    outcome: null,
    store: { name: "App Store" },
    ...overrides,
  });

describe("updateRecoveryView", () => {
  it("shows progress while searching", () => {
    expect(view()).toEqual({
      message: "Getting the latest version…",
      action: null,
    });
  });

  it.each([
    ["an update is pending", { ready: true }],
    ["the search downloads one", { outcome: UpdateSearchOutcome.Downloaded }],
  ])("offers a restart once %s", (_, overrides) => {
    expect(view(overrides).action).toBe(RecoveryAction.Restart);
  });

  it("says so when the restart fails", () => {
    expect(view({ ready: true, restartFailed: true }).message).toBe(
      RESTART_FAILED_MESSAGE,
    );
  });

  it("opens the store when only the store has a newer build", () => {
    expect(view({ outcome: UpdateSearchOutcome.InStore })).toEqual({
      message: "Get it from the App Store.",
      action: RecoveryAction.OpenStore,
    });
  });

  it.each([
    ["nothing newer exists", { outcome: UpdateSearchOutcome.None }],
    [
      "no store serves this platform",
      { outcome: UpdateSearchOutcome.InStore, store: null },
    ],
  ])("says the version isn't out yet when %s", (_, overrides) => {
    expect(view(overrides)).toEqual({
      message:
        "The version of Alliance this form needs isn’t out yet. Please try again later.",
      action: null,
    });
  });

  it("offers a retry when the search fails", () => {
    expect(view({ outcome: UpdateSearchOutcome.Failed }).action).toBe(
      RecoveryAction.Retry,
    );
  });
});

describe("rechecksForUpdate", () => {
  it.each([
    [UpdateSearchOutcome.None, {}, true],
    [UpdateSearchOutcome.Failed, {}, true],
    [UpdateSearchOutcome.InStore, { store: null }, true],
    [UpdateSearchOutcome.InStore, {}, false],
    [UpdateSearchOutcome.Downloaded, {}, false],
    [null, {}, false],
  ])("after %p with %p: %p", (outcome, overrides, expected) => {
    expect(
      rechecksForUpdate({
        outcome,
        view: view({ outcome, ...overrides }),
        focused: true,
      }),
    ).toBe(expected);
  });

  it("stops once an update is pending", () => {
    const outcome = UpdateSearchOutcome.None;
    expect(
      rechecksForUpdate({
        outcome,
        view: view({ outcome, ready: true }),
        focused: true,
      }),
    ).toBe(false);
  });

  it("stops while its screen is covered", () => {
    const outcome = UpdateSearchOutcome.None;
    expect(
      rechecksForUpdate({ outcome, view: view({ outcome }), focused: false }),
    ).toBe(false);
  });
});

describe("afterRecheck", () => {
  it("keeps the last outcome when the recheck fails", () => {
    expect(
      afterRecheck({
        previous: UpdateSearchOutcome.None,
        found: UpdateSearchOutcome.Failed,
      }),
    ).toBe(UpdateSearchOutcome.None);
  });

  it("takes what the recheck found otherwise", () => {
    expect(
      afterRecheck({
        previous: UpdateSearchOutcome.Failed,
        found: UpdateSearchOutcome.Downloaded,
      }),
    ).toBe(UpdateSearchOutcome.Downloaded);
  });
});

describe("startNoticeRechecks", () => {
  afterEach(() => setSystemTime());

  const start = (
    initial: UpdateSearchOutcome | null,
    searchedAt = { current: Date.now() },
  ) => {
    let recheck = () => {};
    const searches = jest.fn();
    let resolveSearch = (_found: UpdateSearchOutcome) => {};
    let outcome = initial;
    const stopListening = jest.fn();
    const stop = startNoticeRechecks({
      onRecheck: (listener) => {
        recheck = listener;
        return stopListening;
      },
      search: () =>
        new Promise((resolve) => {
          searches();
          resolveSearch = resolve;
        }),
      setOutcome: (next) => {
        outcome = next(outcome);
      },
      searchedAt,
    });
    const find = async (found: UpdateSearchOutcome) => {
      recheck();
      resolveSearch(found);
      await Promise.resolve();
    };
    return { stop, stopListening, find, searches, outcome: () => outcome };
  };

  it("searches at once only a full interval after the last search", () => {
    const ago = (ms: number) => ({ current: Date.now() - ms });
    expect(
      start(UpdateSearchOutcome.None, ago(UPDATE_RECHECK_INTERVAL_MS - 1000))
        .searches,
    ).not.toHaveBeenCalled();
    expect(
      start(UpdateSearchOutcome.None, ago(UPDATE_RECHECK_INTERVAL_MS)).searches,
    ).toHaveBeenCalledTimes(1);
  });

  it("records when it applies a search", async () => {
    const searchedAt = { current: 0 };
    const notice = start(UpdateSearchOutcome.None, searchedAt);
    setSystemTime(new Date(UPDATE_RECHECK_INTERVAL_MS * 3));
    await notice.find(UpdateSearchOutcome.None);
    expect(searchedAt.current).toBe(UPDATE_RECHECK_INTERVAL_MS * 3);
  });

  it("applies what a recheck finds, keeping the last outcome on failure", async () => {
    const notice = start(UpdateSearchOutcome.None);
    await notice.find(UpdateSearchOutcome.Failed);
    expect(notice.outcome()).toBe(UpdateSearchOutcome.None);
    await notice.find(UpdateSearchOutcome.Downloaded);
    expect(notice.outcome()).toBe(UpdateSearchOutcome.Downloaded);
  });

  it('applies a failure once "Try again" has cleared the outcome', async () => {
    const notice = start(null);
    await notice.find(UpdateSearchOutcome.Failed);
    expect(notice.outcome()).toBe(UpdateSearchOutcome.Failed);
  });

  it("drops a search that finishes after it stops", async () => {
    const notice = start(UpdateSearchOutcome.None);
    notice.stop();
    expect(notice.stopListening).toHaveBeenCalled();
    await notice.find(UpdateSearchOutcome.Downloaded);
    expect(notice.outcome()).toBe(UpdateSearchOutcome.None);
  });
});

describe("startNoticeSearch", () => {
  afterEach(() => setSystemTime());

  const start = () => {
    const search = Promise.withResolvers<UpdateSearchOutcome>();
    const setOutcome = jest.fn();
    const searchedAt = { current: 0 };
    const stop = startNoticeSearch({
      search: () => search.promise,
      setOutcome,
      searchedAt,
    });
    const find = async (found: UpdateSearchOutcome) => {
      setSystemTime(new Date(UPDATE_RECHECK_INTERVAL_MS * 3));
      search.resolve(found);
      await Promise.resolve();
    };
    return { stop, find, setOutcome, searchedAt };
  };

  it("applies what it finds and records when, so rechecks don't repeat it", async () => {
    const notice = start();
    await notice.find(UpdateSearchOutcome.None);
    expect(notice.setOutcome).toHaveBeenCalledWith(UpdateSearchOutcome.None);
    expect(notice.searchedAt.current).toBe(UPDATE_RECHECK_INTERVAL_MS * 3);
  });

  it("drops what it finds once stopped, still recording when", async () => {
    const notice = start();
    notice.stop();
    await notice.find(UpdateSearchOutcome.Downloaded);
    expect(notice.setOutcome).not.toHaveBeenCalled();
    expect(notice.searchedAt.current).toBe(UPDATE_RECHECK_INTERVAL_MS * 3);
  });
});
