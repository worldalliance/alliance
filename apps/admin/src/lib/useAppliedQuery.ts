import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { adminRefusalMessage } from "./adminRefusal";

export function useAppliedQuery<TInput extends string | number, TData>(params: {
  useQueryFor: (applied: TInput | null) => UseQueryResult<TData>;
  loadErrorFallback: string;
}) {
  const [applied, setApplied] = useState<TInput | null>(null);
  const { data, isFetching, error, refetch } = params.useQueryFor(applied);

  const apply = useCallback(
    (value: TInput) => {
      if (value === applied) void refetch();
      else setApplied(value);
    },
    [applied, refetch],
  );

  return {
    data: error ? undefined : data,
    loading: isFetching,
    loadError:
      error && !isFetching
        ? adminRefusalMessage(error, params.loadErrorFallback)
        : null,
    apply,
  };
}
