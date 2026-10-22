import {
  userCreateAmbassadorProgramInteractionAdmin,
  userGetAmbassadorProgramAdmin,
  userUpdateAmbassadorProgramMemberAdmin,
  userUpsertAmbassadorProgramMemberAdmin,
} from "@alliance/shared/client";
import type {
  CreateAmbassadorProgramInteractionDto,
  UpdateAmbassadorProgramMemberDto,
  UpsertAmbassadorProgramMemberDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useAmbassadorProgramAdmin() {
  return useQuery({
    queryKey: queryKeys.ambassadorProgramAdmin(),
    queryFn: () =>
      userGetAmbassadorProgramAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
  });
}

function useInvalidateAmbassadorProgramAdmin() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.ambassadorProgramAdmin(),
    });
}

export function useUpsertAmbassadorProgramMemberAdmin() {
  const invalidate = useInvalidateAmbassadorProgramAdmin();
  return useMutation({
    mutationFn: (body: UpsertAmbassadorProgramMemberDto) =>
      userUpsertAmbassadorProgramMemberAdmin({
        body,
        throwOnError: true,
      }).then((response) => response.data),
    onSuccess: invalidate,
  });
}

export function useUpdateAmbassadorProgramMemberAdmin() {
  const invalidate = useInvalidateAmbassadorProgramAdmin();
  return useMutation({
    mutationFn: (params: {
      userId: number;
      body: UpdateAmbassadorProgramMemberDto;
    }) =>
      userUpdateAmbassadorProgramMemberAdmin({
        path: { userId: params.userId },
        body: params.body,
        throwOnError: true,
      }).then((response) => response.data),
    onSuccess: invalidate,
  });
}

export function useCreateAmbassadorProgramInteractionAdmin() {
  const invalidate = useInvalidateAmbassadorProgramAdmin();
  return useMutation({
    mutationFn: (body: CreateAmbassadorProgramInteractionDto) =>
      userCreateAmbassadorProgramInteractionAdmin({
        body,
        throwOnError: true,
      }).then((response) => response.data),
    onSuccess: invalidate,
  });
}
