import { notifsLinkClick } from "@alliance/shared/client";
import { posthog } from "posthog-js";
import { useEffect } from "react";
import { useSearchParams } from "react-router";

export const useCIDFromParams = () => {
  const [searchParams, setSearchParams] = useSearchParams();
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
          setSearchParams(searchParams);
        }
        posthog.capture("notif_link_click", {
          cid,
          platform,
        });
      });
    }
  }, [cid, setSearchParams, searchParams]);
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
