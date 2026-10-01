import { waitlistCount, waitlistFindReferral } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { WAITLIST_HREF } from "../../../site/links";

export const LINK_PARAM = "link";
export const REFERRER_PARAM = "ref";

export const personalShareUrl = (code: string): string =>
  `${getInviteBaseUrl()}${WAITLIST_HREF}?${new URLSearchParams({ [REFERRER_PARAM]: code })}`;

export function useWaitlistCount() {
  return useQuery({
    queryKey: queryKeys.waitlistCount(),
    queryFn: () =>
      waitlistCount({ throwOnError: true }).then((res) => res.data.waiting),
    retry: retryUnlessRefused(1),
  });
}

export function useWaitlistReferral() {
  const [searchParams, setSearchParams] = useSearchParams();
  const codes = {
    linkCode: searchParams.get(LINK_PARAM) || undefined,
    referrerCode: searchParams.get(REFERRER_PARAM) || undefined,
  };
  const hasCode =
    codes.linkCode !== undefined || codes.referrerCode !== undefined;
  const query = useQuery({
    queryKey: queryKeys.waitlistReferral(codes),
    queryFn: () =>
      waitlistFindReferral({ query: codes, throwOnError: true }).then(
        (res) => res.data,
      ),
    enabled: hasCode,
    retry: retryUnlessRefused(1),
  });
  const dropReferral = () =>
    setSearchParams(
      (params) => {
        params.delete(LINK_PARAM);
        params.delete(REFERRER_PARAM);
        return params;
      },
      { replace: true },
    );
  return { codes, hasCode, query, dropReferral };
}
