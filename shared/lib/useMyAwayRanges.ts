import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreateAwayRangeDto,
  UpdateAwayRangeDto,
  userCreateAwayRange,
  userDeleteAwayRange,
  userGetAwayRanges,
  userUpdateAwayRange,
} from "../client";
import { queryKeys } from "./queryKeys";
import { useAwayRanges } from "./useAwayRanges";

const QUERY_KEY = queryKeys.myAwayRanges();

/**
 * Single source of truth for the current user's away ranges — wraps
 * `userGetAwayRanges` and the create/update/delete endpoints in react-query,
 * sharing one cache key that every mutation invalidates. Also exposes derived
 * helpers from {@link useAwayRanges} (current/upcoming ranges).
 */
export function useMyAwayRanges(params?: { enabled?: boolean }) {
  const { enabled = true } = params ?? {};
  const queryClient = useQueryClient();

  const {
    data: awayRanges = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      userGetAwayRanges({ throwOnError: true }).then(
        (response) => response.data,
      ),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const createAwayRange = useMutation({
    mutationFn: (body: CreateAwayRangeDto) =>
      userCreateAwayRange({ body, throwOnError: true }).then((r) => r.data),
    onSuccess: invalidate,
  });

  const updateAwayRange = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateAwayRangeDto }) =>
      userUpdateAwayRange({ path: { id }, body, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: invalidate,
  });

  const deleteAwayRange = useMutation({
    mutationFn: (id: number) =>
      userDeleteAwayRange({ path: { id }, throwOnError: true }).then(
        (r) => r.data,
      ),
    // A refusal means the list on screen is out of date with the server's rule.
    onSettled: invalidate,
  });

  const { sortedAwayRanges, currentAwayRange, upcomingOrCurrentAwayRanges } =
    useAwayRanges(awayRanges);

  return {
    awayRanges,
    isPending,
    isError,
    refetch,
    sortedAwayRanges,
    currentAwayRange,
    upcomingOrCurrentAwayRanges,
    createAwayRange,
    updateAwayRange,
    deleteAwayRange,
  };
}
