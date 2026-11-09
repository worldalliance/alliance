import {
  actionBranchesListFormAssignmentsAdmin,
  actionBranchesMoveToBranchAdmin,
  actionBranchesMoveToVariantAdmin,
  actionBranchesPreviewRerouteAdmin,
  actionBranchesRerouteAdmin,
  type MoveToBranchDto,
  type MoveToVariantDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useFormAssignmentsAdmin(actionId: number) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    Promise.all(
      [
        queryKeys.formAssignmentsAdmin(actionId),
        queryKeys.branchesAdmin(actionId),
        queryKeys.formVariantsAdmin(actionId),
        queryKeys.branchRerouteAdmin(actionId),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );

  const assignments = useQuery({
    queryKey: queryKeys.formAssignmentsAdmin(actionId),
    queryFn: () =>
      actionBranchesListFormAssignmentsAdmin({
        path: { id: actionId },
        throwOnError: true,
      }).then((res) => res.data),
  });

  const moveToBranch = useMutation({
    mutationFn: (body: MoveToBranchDto) =>
      actionBranchesMoveToBranchAdmin({
        path: { id: actionId },
        body,
        throwOnError: true,
      }),
    onSuccess: invalidate,
  });

  const moveToVariant = useMutation({
    mutationFn: (body: MoveToVariantDto) =>
      actionBranchesMoveToVariantAdmin({
        path: { id: actionId },
        body,
        throwOnError: true,
      }),
    onSuccess: invalidate,
  });

  const reroute = useMutation({
    mutationFn: (notify: boolean) =>
      actionBranchesRerouteAdmin({
        path: { id: actionId },
        body: { notify },
        throwOnError: true,
      }).then((res) => res.data),
    onSuccess: invalidate,
  });

  return { assignments, moveToBranch, moveToVariant, reroute };
}

export function useReroutePreviewAdmin(params: {
  actionId: number;
  enabled: boolean;
}) {
  const { actionId, enabled } = params;
  return useQuery({
    queryKey: queryKeys.branchRerouteAdmin(actionId),
    queryFn: () =>
      actionBranchesPreviewRerouteAdmin({
        path: { id: actionId },
        throwOnError: true,
      }).then((res) => res.data.moves),
    enabled,
  });
}
