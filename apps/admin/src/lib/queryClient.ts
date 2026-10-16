import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { QueryClient } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: milliseconds({ days: 1 }),
      retry: retryUnlessRefused(3),
    },
  },
});
