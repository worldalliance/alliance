import type { FormResponseDto } from "@alliance/shared/client/types.gen";
import { buildShareText } from "@alliance/shared/lib/shareText";
import { useActionShareUrl } from "@alliance/shared/lib/useActionShareUrl";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { useCallback } from "react";
import { getSiteUrl } from "./config";

export const useCopyActionShareText = () => {
  const actionShareUrl = useActionShareUrl();
  return useCallback(
    async (params: {
      actionId: number;
      isAuthenticated: boolean;
      template?: string | null;
      formResponse?: FormResponseDto | null;
      userName?: string | null;
    }): Promise<boolean> => {
      const { actionId, isAuthenticated, ...text } = params;
      const url = await actionShareUrl({
        actionId,
        isAuthenticated,
        baseUrl: getSiteUrl(),
      });
      return copyToClipboard(buildShareText({ ...text, url }));
    },
    [actionShareUrl],
  );
};
