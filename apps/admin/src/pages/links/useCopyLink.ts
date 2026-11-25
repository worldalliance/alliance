import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { useCallback } from "react";
import { useToast } from "../../ui/ToastProvider";

export const COPY_FAILED = "Couldn't copy the link.";

/** Copies a link and toasts; a failed copy goes to `onFailure`, to be shown on the page. */
export function useCopyLink(onFailure: (message: string) => void) {
  const { success } = useToast();
  return useCallback(
    async (url: string) => {
      if (await copyToClipboard(url)) success("Copied link");
      else onFailure(COPY_FAILED);
    },
    [success, onFailure],
  );
}
