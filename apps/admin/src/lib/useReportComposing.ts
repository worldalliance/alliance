import { COMPOSING_TTL_MS } from "@alliance/common/mmsThreads";
import { milliseconds } from "date-fns";
import { useEffect, useRef } from "react";
import { useMmsThreadsLive } from "./mmsThreadsLive";

/** Edits inside this window aren't reported, so the server's expiry can fall
 * this much short of the last edit. */
const REFRESH_MS = milliseconds({ seconds: 1 });

export function useReportComposing(phoneNumber: string, body: string) {
  const { connected, reportComposing, stopComposing } = useMmsThreadsLive();
  const lastReport = useRef<number | null>(null);
  const lastEdit = useRef(0);
  const composing = body.trim() !== "";

  useEffect(() => {
    lastEdit.current = Date.now();
  }, [body]);

  useEffect(() => {
    if (!connected) {
      lastReport.current = null;
      return;
    }
    if (!composing) {
      if (lastReport.current !== null) stopComposing(phoneNumber);
      lastReport.current = null;
      return;
    }
    const now = Date.now();
    // A reconnect reruns this, and a draft left alone isn't being composed.
    if (now - lastEdit.current >= COMPOSING_TTL_MS) return;
    if (lastReport.current !== null && now - lastReport.current < REFRESH_MS) {
      return;
    }
    lastReport.current = now;
    reportComposing(phoneNumber);
    // body is a dependency so each edit counts as activity.
  }, [body, composing, connected, phoneNumber, reportComposing, stopComposing]);

  useEffect(
    () => () => {
      if (lastReport.current !== null) stopComposing(phoneNumber);
    },
    [phoneNumber, stopComposing],
  );
}
