import {
  type CreateAwayRangeDto,
  type UpdateAwayRangeDto,
  userCreateAwayRangeAdmin,
  userDeleteAwayRangeAdmin,
  userGetAwayRangeForUserAdmin,
  userUpdateAwayRangeAdmin,
} from "@alliance/shared/client";
import { rethrowUnlessNotFound } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useAwayRanges } from "@alliance/shared/lib/useAwayRanges";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useUserAwayRangesAdmin(userId: number) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.userAwayRangesAdmin(userId);

  const query = useQuery({
    queryKey,
    queryFn: () =>
      userGetAwayRangeForUserAdmin({
        path: { id: userId },
        throwOnError: true,
      }).then((r) => r.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createAwayRange = useMutation({
    mutationFn: (body: CreateAwayRangeDto) =>
      userCreateAwayRangeAdmin({
        path: { userId },
        body,
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: invalidate,
  });

  const updateAwayRange = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateAwayRangeDto }) =>
      userUpdateAwayRangeAdmin({
        path: { userId, id },
        body,
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: invalidate,
  });

  const deleteAwayRange = useMutation({
    mutationFn: (id: number) =>
      userDeleteAwayRangeAdmin({
        path: { userId, id },
        throwOnError: true,
      }).then(() => undefined, rethrowUnlessNotFound),
    onSuccess: invalidate,
  });

  const { sortedAwayRanges, currentAwayRange } = useAwayRanges(query.data);

  return {
    query,
    sortedAwayRanges,
    currentAwayRange,
    createAwayRange,
    updateAwayRange,
    deleteAwayRange,
  };
}
