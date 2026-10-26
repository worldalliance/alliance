import { tasksTestCustomExpressionAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  queryOptions,
  skipToken,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

type CustomExpressionTestInput = { expression: string; userId: number | null };

const customExpressionTestQuery = ({
  expression,
  userId,
}: CustomExpressionTestInput) =>
  queryOptions({
    queryKey: queryKeys.customExpressionTestAdmin({ expression, userId }),
    queryFn:
      userId === null
        ? skipToken
        : async () => {
            const { data } = await tasksTestCustomExpressionAdmin({
              body: { expression, userId },
              throwOnError: true,
            });
            const { selectedUserResult } = data;
            if (selectedUserResult === undefined) {
              throw new Error("Missing selected user result.");
            }
            return { ...data, selectedUserResult };
          },
    // Reverting to an earlier input shows no result until it is tested again.
    gcTime: 0,
    retry: false,
  });

/** The result of running `expression` for the selected user and every
 * active-contract member. Being that costly, it runs only on `run`, which
 * reports the outcome through `query`. */
export function useCustomExpressionTestAdmin(input: CustomExpressionTestInput) {
  const { expression, userId } = input;
  const queryClient = useQueryClient();
  const query = useQuery({
    ...customExpressionTestQuery({ expression, userId }),
    enabled: false,
  });

  const run = useCallback(
    () =>
      queryClient.prefetchQuery({
        ...customExpressionTestQuery({ expression, userId }),
        staleTime: 0,
      }),
    [queryClient, expression, userId],
  );

  return { query, run };
}
