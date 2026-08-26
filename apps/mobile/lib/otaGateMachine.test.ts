import { OtaGateOutcome } from "@alliance/common/analytics";
import {
  deadlineFor,
  nextStep,
  OtaGatePhase,
  OtaGateStepKind,
  PHASE_DEADLINES,
  type OtaGateSignals,
} from "./otaGateMachine";

const SETTLED: OtaGateSignals = {
  isStartupProcedureRunning: false,
  isDownloading: false,
  isUpdatePending: false,
  hasCheckError: false,
  hasDownloadError: false,
  restartCount: 0,
};

const RUNNING: OtaGateSignals = { ...SETTLED, isStartupProcedureRunning: true };

const opensWith = (outcome: OtaGateOutcome) => ({
  kind: OtaGateStepKind.Open,
  outcome,
});

describe("nextStep", () => {
  test("holds while the startup check is still running", () => {
    expect(nextStep(OtaGatePhase.Checking, RUNNING)).toEqual({
      kind: OtaGateStepKind.Hold,
    });
  });

  test("opens on no update once the check ends empty", () => {
    expect(nextStep(OtaGatePhase.Checking, SETTLED)).toEqual(
      opensWith(OtaGateOutcome.NoUpdate),
    );
  });

  test("reports the reload landing when the runtime came from one", () => {
    expect(
      nextStep(OtaGatePhase.Checking, { ...SETTLED, restartCount: 1 }),
    ).toEqual(opensWith(OtaGateOutcome.Relaunched));
  });

  // expo clears isUpdatePending when it increments restartCount, so a relaunched
  // runtime has nothing left to apply. If that ever stopped holding, the gate
  // would reload without end.
  test("still applies on a relaunched runtime reporting something pending", () => {
    expect(
      nextStep(OtaGatePhase.Checking, {
        ...SETTLED,
        restartCount: 1,
        isUpdatePending: true,
      }),
    ).toEqual({ kind: OtaGateStepKind.Apply });
  });

  test("enters the download phase when a bundle starts arriving", () => {
    expect(
      nextStep(OtaGatePhase.Checking, { ...RUNNING, isDownloading: true }),
    ).toEqual({ kind: OtaGateStepKind.Download });
  });

  test("applies as soon as an update is pending, from either waiting phase", () => {
    const pending = { ...RUNNING, isUpdatePending: true };
    expect(nextStep(OtaGatePhase.Checking, pending)).toEqual({
      kind: OtaGateStepKind.Apply,
    });
    expect(nextStep(OtaGatePhase.Downloading, pending)).toEqual({
      kind: OtaGateStepKind.Apply,
    });
  });

  test("prefers a pending update over a download still reported in flight", () => {
    expect(
      nextStep(OtaGatePhase.Downloading, {
        ...RUNNING,
        isDownloading: true,
        isUpdatePending: true,
      }),
    ).toEqual({ kind: OtaGateStepKind.Apply });
  });

  test("reports a check error rather than waiting out the deadline", () => {
    expect(
      nextStep(OtaGatePhase.Checking, { ...RUNNING, hasCheckError: true }),
    ).toEqual(opensWith(OtaGateOutcome.CheckError));
  });

  test("reports a download error", () => {
    expect(
      nextStep(OtaGatePhase.Downloading, {
        ...RUNNING,
        hasDownloadError: true,
      }),
    ).toEqual(opensWith(OtaGateOutcome.DownloadError));
  });

  test("distinguishes a download that ends without landing from having no update", () => {
    expect(nextStep(OtaGatePhase.Downloading, SETTLED)).toEqual(
      opensWith(OtaGateOutcome.DownloadIncomplete),
    );
  });

  test("holds through the apply phase, whatever the native machine says", () => {
    for (const signals of [
      SETTLED,
      RUNNING,
      { ...RUNNING, isUpdatePending: true },
      { ...SETTLED, hasDownloadError: true },
    ]) {
      expect(nextStep(OtaGatePhase.Applying, signals)).toEqual({
        kind: OtaGateStepKind.Hold,
      });
    }
  });

  test("never reopens once the app is visible", () => {
    for (const signals of [
      SETTLED,
      RUNNING,
      { ...RUNNING, isDownloading: true },
      { ...RUNNING, isUpdatePending: true },
      { ...SETTLED, hasCheckError: true },
    ]) {
      expect(nextStep(OtaGatePhase.Open, signals)).toEqual({
        kind: OtaGateStepKind.Hold,
      });
    }
  });
});

describe("deadlines", () => {
  test("the terminal phase has none", () => {
    expect(deadlineFor(OtaGatePhase.Open)).toBeNull();
  });

  test("every waiting phase has one", () => {
    for (const phase of [
      OtaGatePhase.Checking,
      OtaGatePhase.Downloading,
      OtaGatePhase.Applying,
    ]) {
      expect(deadlineFor(phase)?.ms).toBeGreaterThan(0);
    }
  });

  test("the worst case a user can wait at launch stays under half a minute", () => {
    const total = Object.values(PHASE_DEADLINES).reduce(
      (sum, deadline) => sum + deadline.ms,
      0,
    );
    expect(total).toBeLessThanOrEqual(30_000);
  });

  test("only the apply deadline corrects an outcome already reported", () => {
    expect(PHASE_DEADLINES[OtaGatePhase.Checking].supersedes).toBeNull();
    expect(PHASE_DEADLINES[OtaGatePhase.Downloading].supersedes).toBeNull();
    expect(PHASE_DEADLINES[OtaGatePhase.Applying].supersedes).toBe(
      OtaGateOutcome.Applied,
    );
  });
});
