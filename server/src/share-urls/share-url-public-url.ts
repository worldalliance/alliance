import { signupUrl, withRef } from "src/search/approutes";
import { type ShareUrl, ShareUrlKind } from "./entities/share-url.entity";

/**
 * Invite links render from the currently configured invite domain rather than
 * the stored column, so rows minted under an earlier domain follow the config.
 */
export function shareUrlPublicUrl(shareUrl: ShareUrl): string {
  if (shareUrl.kind !== ShareUrlKind.Invite || !shareUrl.sid) {
    return shareUrl.url;
  }
  return withRef(signupUrl(true), shareUrl.sid);
}
