import { OtaGateOutcome } from "@alliance/common/analytics";

export enum OtaGatePhase {
  Checking = "checking",
  Downloading = "downloading",
  /** A reload has already been asked for. */
  Applying = "applying",
  Open = "open",
}

export type WaitingPhase = Exclude<OtaGatePhase, OtaGatePhase.Open>;

export interface OtaGateSignals {
  isStartupProcedureRunning: boolean;
  isDownloading: boolean;
  isUpdatePending: boolean;
  hasCheckError: boolean;
  hasDownloadError: boolean;
  /** JS restarts since cold start. Above 0 means a reload produced this runtime. */
  restartCount: number;
}

export enum OtaGateStepKind {
  Hold = "hold",
  Download = "download",
  Apply = "apply",
  Open = "open",
}

export type OtaGateStep =
  | { kind: OtaGateStepKind.Hold }
  | { kind: OtaGateStepKind.Download }
  | { kind: OtaGateStepKind.Apply }
  | { kind: OtaGateStepKind.Open; outcome: OtaGateOutcome };

const HOLD: OtaGateStep = { kind: OtaGateStepKind.Hold };

const open = (outcome: OtaGateOutcome): OtaGateStep => ({
  kind: OtaGateStepKind.Open,
  outcome,
});

function stepWhileWaiting(signals: OtaGateSignals): OtaGateStep | null {
  if (signals.isUpdatePending) return { kind: OtaGateStepKind.Apply };
  if (signals.isDownloading) return { kind: OtaGateStepKind.Download };
  if (signals.hasCheckError) return open(OtaGateOutcome.CheckError);
  if (signals.hasDownloadError) return open(OtaGateOutcome.DownloadError);
  return signals.isStartupProcedureRunning ? HOLD : null;
}

export function nextStep(
  phase: OtaGatePhase,
  signals: OtaGateSignals,
): OtaGateStep {
  switch (phase) {
    case OtaGatePhase.Checking:
      return (
        stepWhileWaiting(signals) ??
        open(
          signals.restartCount > 0
            ? OtaGateOutcome.Relaunched
            : OtaGateOutcome.NoUpdate,
        )
      );

    // Not `NoUpdate`, which would hide it among the launches that had no work.
    case OtaGatePhase.Downloading:
      return (
        stepWhileWaiting(signals) ?? open(OtaGateOutcome.DownloadIncomplete)
      );

    case OtaGatePhase.Applying:
      return HOLD;

    case OtaGatePhase.Open:
      return HOLD;

    default:
      throw new Error(`unknown gate phase: ${phase satisfies never}`);
  }
}

export interface PhaseDeadline {
  ms: number;
  outcome: OtaGateOutcome;
  supersedes: OtaGateOutcome | null;
}

export const PHASE_DEADLINES: Record<WaitingPhase, PhaseDeadline> = {
  [OtaGatePhase.Checking]: {
    ms: 2_000,
    outcome: OtaGateOutcome.CheckTimedOut,
    supersedes: null,
  },
  // More than the check gets, because this phase shows progress and a skip control.
  [OtaGatePhase.Downloading]: {
    ms: 20_000,
    outcome: OtaGateOutcome.DownloadTimedOut,
    supersedes: null,
  },
  // reloadAsync resolves before the reload lands, so nothing else can end this phase.
  [OtaGatePhase.Applying]: {
    ms: 5_000,
    outcome: OtaGateOutcome.ReloadStalled,
    supersedes: OtaGateOutcome.Applied,
  },
};

export function deadlineFor(phase: OtaGatePhase): PhaseDeadline | null {
  return phase === OtaGatePhase.Open ? null : PHASE_DEADLINES[phase];
}
