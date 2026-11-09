import {
  actionBranchesCreateBranchAdmin,
  actionBranchesDeleteBranchAdmin,
  actionBranchesListBranchesAdmin,
  actionBranchesReorderBranchesAdmin,
  actionBranchesUpdateBranchAdmin,
  type ActionBranchesListDto,
  type CreateActionBranchDto,
  type UpdateActionBranchDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useInvalidateFormsIndex } from "@alliance/shared/lib/useFormsAdmin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const branchesQuery = (actionId: number) => ({
  queryKey: queryKeys.branchesAdmin(actionId),
  queryFn: () =>
    actionBranchesListBranchesAdmin({
      path: { id: actionId },
      throwOnError: true,
    }).then((res) => res.data),
});

export function useBranchesAdmin<T = ActionBranchesListDto>(
  actionId: number,
  select?: (list: ActionBranchesListDto) => T,
) {
  const queryClient = useQueryClient();
  const invalidateFormsIndex = useInvalidateFormsIndex();
  const invalidate = () =>
    Promise.all(
      [
        queryKeys.branchesAdmin(actionId),
        queryKeys.branchRerouteAdmin(actionId),
        queryKeys.formAssignmentsAdmin(actionId),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );

  const branches = useQuery({ ...branchesQuery(actionId), select });

  const createBranch = useMutation({
    mutationFn: (body: CreateActionBranchDto) =>
      actionBranchesCreateBranchAdmin({
        path: { id: actionId },
        body,
        throwOnError: true,
      }).then((res) => res.data),
    // Each branch clones its source form into a new form.
    onSuccess: () => Promise.all([invalidate(), invalidateFormsIndex()]),
  });

  const updateBranch = useMutation({
    mutationFn: (params: { branchId: number; body: UpdateActionBranchDto }) =>
      actionBranchesUpdateBranchAdmin({
        path: { branchId: params.branchId },
        body: params.body,
        throwOnError: true,
      }),
    onSuccess: invalidate,
  });

  const deleteBranch = useMutation({
    mutationFn: (branchId: number) =>
      actionBranchesDeleteBranchAdmin({
        path: { branchId },
        throwOnError: true,
      }),
    onSuccess: () => Promise.all([invalidate(), invalidateFormsIndex()]),
  });

  const reorderBranches = useMutation({
    mutationFn: (branchIds: number[]) =>
      actionBranchesReorderBranchesAdmin({
        path: { id: actionId },
        body: { branchIds },
        throwOnError: true,
      }),
    onSuccess: invalidate,
  });

  return {
    branches,
    createBranch,
    updateBranch,
    deleteBranch,
    reorderBranches,
  };
}
