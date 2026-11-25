import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useFormsAdmin } from "@alliance/shared/lib/useFormsAdmin";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/** `useFormsAdmin` with the List's load, refetch and retry states. */
export function useFormsList() {
  const { forms, isLoading, isError, error, isFetching, refetch, deleteForm } =
    useFormsAdmin();
  const queryClient = useQueryClient();
  // The response counts sit under the same key prefix as the index.
  const refetchAll = useCallback(
    () => queryClient.refetchQueries({ queryKey: queryKeys.formsAdminAll() }),
    [queryClient],
  );
  // The hook answers an empty list until the first load lands, so rows on
  // screen mean a failure is a refetch's.
  const loaded = forms.length > 0;
  return {
    error,
    isFetching,
    refetch,
    forms,
    isLoading,
    isPending: isLoading,
    isLoadingError: isError && !loaded,
    isRefetchError: isError && loaded,
    refetchAll,
    deleteForm,
  };
}
