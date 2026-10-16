import { tasksFindOneCustomValidatorAdmin } from "@alliance/shared/client";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  queryOptions,
  skipToken,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
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

/** A saved validator's settings; a `null` id fetches nothing. `exists`
 * resolves false when the server refuses the id, and rejects only when the
 * server can't be reached. */
export function useCustomValidatorAdmin(id: number | null) {
  const queryClient = useQueryClient();
  const query = useQuery(
    id === null
      ? { queryKey: queryKeys.customValidatorAdmin(0), queryFn: skipToken }
      : customValidatorQuery(id),
  );

  const exists = useCallback(
    (validatorId: number) =>
      queryClient.fetchQuery(customValidatorQuery(validatorId)).then(
        () => true,
        (error: unknown) => {
          if (thrownStatus(error) === undefined) throw error;
          return false;
        },
      ),
    [queryClient],
  );

  return { query, exists };
}
