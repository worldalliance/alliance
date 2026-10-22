import { type QueryKey, useQueryClient } from "@tanstack/react-query";

export function useListCache<T>(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  return {
    update: (updater: (old: T[]) => T[]) =>
      queryClient.setQueryData<T[]>(queryKey, (old = []) => updater(old)),
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
  };
}
