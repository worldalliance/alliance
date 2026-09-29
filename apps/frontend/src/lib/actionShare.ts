import type { FormResponseDto } from "@alliance/shared/client/types.gen";
import {
  buildActionShareUrl,
  buildShareText,
} from "@alliance/shared/lib/shareText";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getSiteUrl } from "./config";

type ActionShareTarget = { actionId: number; isAuthenticated: boolean };

export const actionShareUrl = (target: ActionShareTarget): Promise<string> =>
  buildActionShareUrl({ ...target, baseUrl: getSiteUrl() });

export const copyActionShareText = async (
  params: ActionShareTarget & {
    template?: string | null;
    formResponse?: FormResponseDto | null;
    userName?: string | null;
  },
): Promise<boolean> => {
  const { actionId, isAuthenticated, ...text } = params;
  const url = await actionShareUrl({ actionId, isAuthenticated });
  return copyToClipboard(buildShareText({ ...text, url }));
};
