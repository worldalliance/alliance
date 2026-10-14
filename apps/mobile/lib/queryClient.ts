import { invalidateActions } from "@alliance/shared/lib/actionsListPage";
import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { QueryClient } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: milliseconds({ minutes: 5 }),
      gcTime: milliseconds({ minutes: 30 }),
      retry: retryUnlessRefused(2),
      refetchOnWindowFocus: false,
    },
  },
});

export const refetchActions = (): void => invalidateActions(queryClient);
