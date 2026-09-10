import {
  OAuthIntent,
  OAuthProvider,
  oauthErrorMessage,
  oauthErrorParam,
  oauthOutcomeMessage,
  oauthOutcomeParam,
  parseOAuthError,
  parseOAuthOutcome,
  type OAuthError,
  type OAuthOutcome,
} from "@alliance/common/oauth";
import { deviceTimeZone } from "@alliance/shared/lib/timeZone";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

/**
 * For a top-level navigation, not a fetch. The server answers with a redirect
 * to the provider, which will not render inside an XHR.
 */
export function oauthStartUrl(params: {
  apiUrl: string;
  provider: OAuthProvider;
  intent: OAuthIntent;
  returnTo: string;
  referralCode?: string | null;
}): string {
  const url = new URL(`${params.apiUrl}/auth/${params.provider}/start`);
  url.searchParams.set("intent", params.intent);
  url.searchParams.set("returnTo", params.returnTo);
  url.searchParams.set("timeZone", deviceTimeZone());
  if (params.referralCode) {
    url.searchParams.set("referralCode", params.referralCode);
  }
  return url.toString();
}

/**
 * The origin the member is on, once mounted. SSR has no location and the
 * server only accepts an absolute returnTo, so until then the caller's
 * canonical origin stands in: a click before hydration finishes the flow on
 * that domain rather than on a dead button.
 */
export function useAppOrigin(canonical: string): string {
  const [origin, setOrigin] = useState(canonical);
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

export type OAuthNotice =
  | { kind: "outcome"; provider: OAuthProvider; outcome: OAuthOutcome }
  | { kind: "error"; provider: OAuthProvider; error: OAuthError };

export function oauthNoticeMessage(notice: OAuthNotice): string | null {
  switch (notice.kind) {
    case "outcome":
      return oauthOutcomeMessage(notice.provider, notice.outcome);
    case "error":
      return oauthErrorMessage(notice.provider, notice.error);
    default:
      throw new Error(`unknown notice: ${notice satisfies never}`);
  }
}

function readNotice(params: URLSearchParams): OAuthNotice | null {
  for (const provider of Object.values(OAuthProvider)) {
    const error = parseOAuthError(params.get(oauthErrorParam(provider)));
    if (error) {
      return { kind: "error", provider, error };
    }
    const outcome = parseOAuthOutcome(params.get(oauthOutcomeParam(provider)));
    if (outcome) {
      return { kind: "outcome", provider, outcome };
    }
  }
  return null;
}

/**
 * Reads what the callback appended, then strips it so a reload does not replay
 * the message. Read once, synchronously, so an effect that navigates on the
 * outcome sees it on its first run.
 */
export function useOAuthNotice(): OAuthNotice | null {
  const [searchParams, setSearchParams] = useSearchParams();
  const [notice] = useState(() => readNotice(searchParams));

  useEffect(() => {
    if (!notice) {
      return;
    }
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const provider of Object.values(OAuthProvider)) {
          next.delete(oauthOutcomeParam(provider));
          next.delete(oauthErrorParam(provider));
        }
        return next;
      },
      { replace: true },
    );
  }, [notice, setSearchParams]);

  return notice;
}
