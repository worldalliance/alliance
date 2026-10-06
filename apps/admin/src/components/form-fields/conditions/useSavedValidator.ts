import { tasksFindOneCustomValidatorAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { skipToken, useQuery } from "@tanstack/react-query";
import type { CustomValidatorDraft } from "../customValidatorDrafts";

/** A saved validator's settings; null `validatorId` skips the lookup. */
export function useSavedValidator(validatorId: number | null) {
  return useQuery({
    queryKey: queryKeys.customValidatorAdmin(validatorId ?? 0),
    queryFn:
      validatorId === null
        ? skipToken
        : async (): Promise<CustomValidatorDraft> => {
            const { data } = await tasksFindOneCustomValidatorAdmin({
              path: { id: validatorId },
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
}
