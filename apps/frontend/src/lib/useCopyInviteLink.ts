import { getOnetimeInviteSignupUrl } from "@alliance/shared/lib/inviteUrls";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback } from "react";

export function useCopyInviteLink() {
  const { error: errorToast } = useToast();
  return useCallback(
    async (code: string) => {
      const copied = await copyToClipboard(
        getOnetimeInviteSignupUrl(getInviteBaseUrl(), code),
      );
      if (!copied) {
        errorToast("Could not copy the invite link.");
      }
      return copied;
    },
    [errorToast],
  );
}
