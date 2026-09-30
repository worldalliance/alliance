import {
  WAITLIST_LINK_PARAM,
  WAITLIST_REFERRER_PARAM,
  waitlistShareUrl,
} from "@alliance/common/waitlist";
import { waitlistCount, waitlistFindReferral } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

export const personalShareUrl = (code: string): string =>
  waitlistShareUrl(getInviteBaseUrl(), code);

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
    linkCode: searchParams.get(WAITLIST_LINK_PARAM) || undefined,
    referrerCode: searchParams.get(WAITLIST_REFERRER_PARAM) || undefined,
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
        params.delete(WAITLIST_LINK_PARAM);
        params.delete(WAITLIST_REFERRER_PARAM);
        return params;
      },
      { replace: true },
    );
  return { codes, hasCode, query, dropReferral };
}
