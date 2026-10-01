import { externalShareTargetsFindAllAdmin } from "@alliance/shared/client";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { sessionExpiredMessage } from "./sessionExpired";

export const externalShareTargetsQuery = queryOptions({
  queryKey: queryKeys.externalShareTargetsAdmin(),
  queryFn: () =>
    externalShareTargetsFindAllAdmin({ throwOnError: true }).then(
      (r) => r.data,
    ),
});

export function useExternalShareTargetsAdmin() {
  return useQuery(externalShareTargetsQuery);
}

export const externalShareTargetsLoadError = (error: unknown) =>
  thrownRefusalMessage({
    error,
    fallback: "Failed to load share targets.",
    sessionExpired: sessionExpiredMessage,
  });
