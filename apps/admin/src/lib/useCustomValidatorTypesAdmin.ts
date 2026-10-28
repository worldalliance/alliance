import { customValidatorCustomValidatorsAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { adminRefusalMessage } from "./adminRefusal";

/** The kinds of validator an admin can pick from, which change only with a
 * server deploy. */
export function useCustomValidatorTypesAdmin() {
  const {
    data = [],
    isPending,
    error,
  } = useQuery({
    queryKey: queryKeys.customValidatorTypesAdmin(),
    queryFn: () =>
      customValidatorCustomValidatorsAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
    staleTime: Infinity,
  });
  return {
    validators: data,
    loading: isPending,
    error: error
      ? adminRefusalMessage(error, "Failed to load validators")
      : null,
  };
}
