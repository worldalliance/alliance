import { AnalyticsEvent, OtaGateOutcome } from "@alliance/common/analytics";
import { R } from "@alliance/common/result";
import {
  captureEvent,
  flushAnalytics,
  FlushOutcome,
} from "@alliance/shared/lib/analytics";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";
import { SPLASH_BACKGROUND_COLOR, SPLASH_IMAGE } from "../constants/splash";
import {
  deadlineFor,
  nextStep,
  OtaGatePhase,
  OtaGateStepKind,
} from "./otaGateMachine";

// posthog persists its queue asynchronously and reloadAsync tears down the JS
// runtime, so the `applied` event races the reload it describes. Bounded
// because a slow network must not lengthen a launch we are trying to shorten.
const ANALYTICS_FLUSH_TIMEOUT_MS = 500;

// Whether an outcome is worth a line in the device log before the reload takes
// the runtime with it. A record rather than a comparison so a new outcome has
// to be opted in or out here instead of quietly landing on silence.
const WARNS_BEFORE_RELOAD: Record<FlushOutcome, boolean> = {
  [FlushOutcome.Flushed]: false,
  [FlushOutcome.Failed]: true,
  [FlushOutcome.TimedOut]: true,
  [FlushOutcome.NoBackend]: true,
  [FlushOutcome.Unsupported]: true,
};

export interface OtaUpdateGate {
  phase: OtaGatePhase;
  /** 0 to 1, or `null` when the download reports no intermediate progress. */
  progress: number | null;
  skip: () => void;
}

/**
 * Blocks the first render while `expo-updates` finishes the startup check it
 * already began before the JS bundle loaded, so a freshly published update
 * lands on this launch instead of the next one.
 *
 * `launchWaitMs` stays 0 deliberately: waiting natively would hold a splash
 * screen with no progress, no skip control, and no way to report timings. This
 * hook observes the same native state machine from JS, where all three are
 * possible.
 */
export function useOtaUpdateGate(): OtaUpdateGate {
  const {
    isStartupProcedureRunning,
    isDownloading,
    isUpdatePending,
    downloadProgress,
    checkError,
    downloadError,
    restartCount,
  } = Updates.useUpdates();

  const enabled = Updates.isEnabled && !__DEV__;
  const [phase, setPhase] = useState(
    enabled ? OtaGatePhase.Checking : OtaGatePhase.Open,
  );

  const startedAt = useRef(Date.now());
  const downloadStartedAt = useRef<number | null>(null);
  const resolved = useRef(false);
  // Distinct fractional readings. Expo only reports these continuously when the
  // asset response carries a Content-Length; the CDN serves the bundle brotli
  // encoded, so it may jump straight from 0 to 1. Counting them tells us
  // whether the progress bar is showing real data or theatre.
  const progressSamples = useRef(new Set<number>());

  useEffect(() => {
    if (downloadProgress !== undefined && downloadProgress > 0) {
      progressSamples.current.add(downloadProgress);
    }
  }, [downloadProgress]);

  const report = useCallback(
    (outcome: OtaGateOutcome, supersedes?: OtaGateOutcome | null) => {
      const samples = [...progressSamples.current];
      captureEvent(AnalyticsEvent.OtaGateResolved, {
        outcome,
        supersedes: supersedes ?? null,
        total_ms: Date.now() - startedAt.current,
        download_ms: downloadStartedAt.current
          ? Date.now() - downloadStartedAt.current
          : null,
        progress_sample_count: samples.length,
        // 0 on the runtime a launch starts with, 1 on the one a reload of ours
        // produced. Launch counts filter on it.
        restart_count: restartCount,
        // Answers whether a determinate progress bar is worth keeping.
        saw_intermediate_progress: samples.some((p) => p < 1),
        runtime_version: Updates.runtimeVersion,
        channel: Updates.channel,
      });
    },
    [restartCount],
  );

  /** Lets the user into the app and reports why. First caller wins. */
  const resolve = useCallback(
    (outcome: OtaGateOutcome, supersedes?: OtaGateOutcome | null) => {
      if (resolved.current) return;
      resolved.current = true;
      // Opened before it is reported, because `resolved` has already closed the
      // door on a second attempt: anything that goes wrong on the way to
      // posthog must not be able to leave the gate shut for good.
      setPhase(OtaGatePhase.Open);
      report(outcome, supersedes);
    },
    [report],
  );

  const apply = useCallback(async () => {
    setPhase(OtaGatePhase.Applying);
    // Reported before the reload rather than after, because a reload that works
    // never gets to report anything. A reload that doesn't corrects this below.
    report(OtaGateOutcome.Applied);

    // The event captured a line above is the one at risk here, so anything
    // short of a flush means it may never have left the device.
    const { outcome, error } = await flushAnalytics(ANALYTICS_FLUSH_TIMEOUT_MS);
    if (WARNS_BEFORE_RELOAD[outcome]) {
      console.warn(
        `[ota] analytics unsent before reload: ${outcome}`,
        ...(error ? [error] : []),
      );
    }

    const result = await R.fromPromise(
      Updates.reloadAsync({
        // The same stand-in the splash and the gate use, so the restart reads
        // as one continuous launch rather than a flash of white.
        reloadScreenOptions: {
          backgroundColor: SPLASH_BACKGROUND_COLOR,
          image: SPLASH_IMAGE,
          imageResizeMode: "contain",
          fade: true,
        },
      }),
    );

    // The reload never started, so this runtime is still live and still hidden
    // behind the gate. Let the user into the app on the old bundle. A reload
    // that starts and then doesn't finish is the apply deadline's problem.
    if (R.isFailure(result)) {
      resolve(OtaGateOutcome.ReloadFailed, OtaGateOutcome.Applied);
    }
  }, [report, resolve]);

  useEffect(() => {
    if (!enabled || resolved.current) return;

    const step = nextStep(phase, {
      isStartupProcedureRunning,
      isDownloading,
      isUpdatePending,
      hasCheckError: checkError !== undefined,
      hasDownloadError: downloadError !== undefined,
      restartCount,
    });

    switch (step.kind) {
      case OtaGateStepKind.Hold:
        return;
      case OtaGateStepKind.Download:
        downloadStartedAt.current ??= Date.now();
        setPhase(OtaGatePhase.Downloading);
        return;
      case OtaGateStepKind.Apply:
        void apply();
        return;
      case OtaGateStepKind.Open:
        resolve(step.outcome);
        return;
      default:
        throw new Error(`unknown gate step: ${step satisfies never}`);
    }
  }, [
    enabled,
    phase,
    isStartupProcedureRunning,
    isDownloading,
    isUpdatePending,
    checkError,
    downloadError,
    restartCount,
    apply,
    resolve,
  ]);

  useEffect(() => {
    if (!enabled || resolved.current) return;

    const deadline = deadlineFor(phase);
    if (!deadline) return;

    const timer = setTimeout(
      () => resolve(deadline.outcome, deadline.supersedes),
      deadline.ms,
    );
    return () => clearTimeout(timer);
  }, [enabled, phase, resolve]);

  const skip = useCallback(() => resolve(OtaGateOutcome.Skipped), [resolve]);

  return {
    phase,
    progress:
      downloadProgress !== undefined && downloadProgress > 0
        ? downloadProgress
        : null,
    skip,
  };
}
