import { koraReviewReportActiveTime } from "@alliance/shared/client";
import { useEffect } from "react";
import { createActiveTimeCounter } from "./koraActiveTime";

const INPUT_EVENTS = [
  "pointerdown",
  "keydown",
  "scroll",
  "wheel",
  "touchstart",
];

export function useKoraActiveTime(assignmentId: string | null) {
  useEffect(() => {
    if (assignmentId === null) return;
    const counter = createActiveTimeCounter({
      now: () => Date.now(),
      report: (seconds) =>
        void koraReviewReportActiveTime({
          path: { id: assignmentId },
          body: { seconds },
          throwOnError: true,
        }).catch((error: unknown) =>
          // A lost report only undercounts; the conversation count still ends the task.
          console.warn("Couldn't report Kora active time", error),
        ),
    });
    const onInput = () => counter.input();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") counter.flush();
    };
    for (const name of INPUT_EVENTS) {
      window.addEventListener(name, onInput, { capture: true, passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(
      () => counter.tick(document.visibilityState === "visible"),
      1000,
    );
    return () => {
      clearInterval(timer);
      for (const name of INPUT_EVENTS) {
        window.removeEventListener(name, onInput, { capture: true });
      }
      document.removeEventListener("visibilitychange", onVisibility);
      counter.flush();
    };
  }, [assignmentId]);
}
