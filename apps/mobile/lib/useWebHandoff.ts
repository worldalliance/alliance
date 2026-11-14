import { webHandoffCreate } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

/** A single-use code for signing this member into a webview; a fresh one on every mount. */
export function useWebHandoffCode() {
  return useQuery({
    queryKey: queryKeys.webHandoff(),
    queryFn: () =>
      webHandoffCreate({ throwOnError: true }).then((res) => res.data.code),
    gcTime: 0,
    staleTime: Infinity,
    retry: 1,
  });
}
