import {
  type MemberListDto,
  type SaveMemberListDto,
  type UpdateMemberListDto,
  memberListsCreateAdmin,
  memberListsListAdmin,
  memberListsUpdateAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useMemberListsAdmin() {
  return useQuery({
    queryKey: queryKeys.memberListsAdmin(),
    queryFn: () =>
      memberListsListAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

export function useSaveMemberListAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      input:
        | { id: undefined; body: SaveMemberListDto }
        | { id: string; body: UpdateMemberListDto },
    ): Promise<MemberListDto> =>
      (input.id === undefined
        ? memberListsCreateAdmin({ body: input.body, throwOnError: true })
        : memberListsUpdateAdmin({
            path: { id: input.id },
            body: input.body,
            throwOnError: true,
          })
      ).then((r) => r.data),
    // Formula text prints a list by its current name, so a rename changes it.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.memberListsAdmin(),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.formulasAdmin() }),
      ]),
  });
}

/** Drops a deleted list from the cached list, so the lists page never shows it. */
export function useForgetMemberListAdmin() {
  const queryClient = useQueryClient();
  return (id: string) =>
    queryClient.setQueryData<MemberListDto[]>(
      queryKeys.memberListsAdmin(),
      (lists) => lists?.filter((list) => list.id !== id),
    );
}
