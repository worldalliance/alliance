import { AnalyticsEvent } from "@alliance/common/analytics";
import { captureEvent } from "@alliance/shared/lib/analytics";
import { posthog } from "posthog-js";
import { useEffect } from "react";
import { useSearchParams } from "react-router";

export const useSidFromParams = (actionId?: number) => {
  const [searchParams] = useSearchParams();
  const sid = searchParams.get("sid") ?? searchParams.get("ref");
  useEffect(() => {
    if (sid) {
      posthog.register_for_session({ sid });
      captureEvent(AnalyticsEvent.SidLoad, {
        sid,
        actionId,
      });
    }
  }, [sid, actionId]);
};

export const generateBarcodeUrl = (url: string, size: number) => {
  return (
    "https://api.qrserver.com/v1/create-qr-code/?data=" +
    encodeURIComponent(url) +
    "&size=" +
    size +
    "x" +
    size
  );
};
