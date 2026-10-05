import { AnalyticsEvent } from "@alliance/common/analytics";
import { notifsLinkClick } from "@alliance/shared/client";
import { captureEvent } from "@alliance/shared/lib/analytics";
import { useNotifications } from "@alliance/shared/lib/useNotifications";
import { posthog } from "posthog-js";
import { useEffect } from "react";
import { useSearchParams } from "react-router";

export const useCIDFromParams = (actionId?: number) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshNotifications } = useNotifications();
  const cid = searchParams.get("cid");

  useEffect(() => {
    if (cid) {
      posthog.register_for_session({ cid });

      notifsLinkClick({
        body: { cid },
      }).then((response) => {
        let platform = "unknown";
        if (response.data) {
          platform = response.data.mms ? "mms" : "email";
          searchParams.delete("cid");
          setSearchParams(searchParams, {
            replace: true,
            preventScrollReset: true,
          });
        }
        captureEvent(AnalyticsEvent.NotifLinkClick, {
          cid,
          platform,
          actionId,
        });
        refreshNotifications({ limit: 20 });
      });
    }
  }, [cid, setSearchParams, searchParams, actionId, refreshNotifications]);

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
