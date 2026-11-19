import { UnrenderableSubject } from "@alliance/shared/forms/unrenderable";
import { UpdateSearchOutcome } from "../lib/updateSearch";
import { RESTART_FAILED_MESSAGE } from "./updateCopy";
import { RecoveryAction, updateRecoveryView } from "./updateRecoveryView";

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
