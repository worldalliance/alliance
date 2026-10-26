import {
  actionFormsListFormAssignmentsAdmin,
  actionFormsMoveFormMemberAdmin,
  actionFormsPreviewRerouteAdmin,
  actionFormsRerouteAdmin,
  type MoveActionFormMemberDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useFormAssignmentsAdmin(actionId: number) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    Promise.all(
      [
        queryKeys.formAssignmentsAdmin(actionId),
        queryKeys.formVariantsAdmin(actionId),
        queryKeys.formRerouteAdmin(actionId),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );

  const assignments = useQuery({
    queryKey: queryKeys.formAssignmentsAdmin(actionId),
    queryFn: () =>
      actionFormsListFormAssignmentsAdmin({
        path: { id: actionId },
        throwOnError: true,
      }).then((res) => res.data),
  });

  const move = useMutation({
    mutationFn: (body: MoveActionFormMemberDto) =>
      actionFormsMoveFormMemberAdmin({
        path: { id: actionId },
        body,
        throwOnError: true,
      }),
    onSuccess: invalidate,
  });

  const reroute = useMutation({
    mutationFn: (notify: boolean) =>
      actionFormsRerouteAdmin({
        path: { id: actionId },
        body: { notify },
        throwOnError: true,
      }).then((res) => res.data),
    onSuccess: invalidate,
  });

  return { assignments, move, reroute };
}

export function useReroutePreviewAdmin(params: {
  actionId: number;
  enabled: boolean;
}) {
  const { actionId, enabled } = params;
  return useQuery({
    queryKey: queryKeys.formRerouteAdmin(actionId),
    queryFn: () =>
      actionFormsPreviewRerouteAdmin({
        path: { id: actionId },
        throwOnError: true,
      }).then((res) => res.data.moves),
    enabled,
  });
}
