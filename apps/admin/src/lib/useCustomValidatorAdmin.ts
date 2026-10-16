import { tasksFindOneCustomValidatorAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";
import type { CustomValidatorDraft } from "../components/form-fields/customValidatorDrafts";

const customValidatorQuery = (id: number) =>
  queryOptions({
    queryKey: queryKeys.customValidatorAdmin(id),
    queryFn: async (): Promise<CustomValidatorDraft> => {
      const { data } = await tasksFindOneCustomValidatorAdmin({
        path: { id },
        throwOnError: true,
      });
      return {
        type: data.type,
        idArgument: data.idArgument,
        expression: data.expression,
      };
    },
    // A saved validator never changes: editing one saves a new id.
    staleTime: Infinity,
    retry: false,
  });

/** A saved validator's settings; a `null` id fetches nothing. */
export function useCustomValidatorAdmin(id: number | null) {
  const query = useQuery(
    id === null
      ? { queryKey: queryKeys.customValidatorAdmin(0), queryFn: skipToken }
      : customValidatorQuery(id),
  );

  return { query };
}
