import {
  waitlistAdminFindEntryMetricsAdmin,
  waitlistAdminSearchEntriesAdmin,
} from "@alliance/shared/client";
import type {
  WaitlistEntryFilterDto,
  WaitlistEntrySearchDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useWaitlistEntriesAdmin(search: WaitlistEntrySearchDto) {
  return useQuery({
    queryKey: queryKeys.waitlistEntriesAdmin(search),
    queryFn: () =>
      waitlistAdminSearchEntriesAdmin({
        body: search,
        throwOnError: true,
      }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

export function useWaitlistEntryMetricsAdmin(filter: WaitlistEntryFilterDto) {
  return useQuery({
    queryKey: queryKeys.waitlistEntryMetricsAdmin(filter),
    queryFn: () =>
      waitlistAdminFindEntryMetricsAdmin({
        body: { filter },
        throwOnError: true,
      }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}
