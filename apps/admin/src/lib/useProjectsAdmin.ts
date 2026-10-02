import {
  projectsAssignActionAdmin,
  projectsCreateAdmin,
  projectsFindAllAdmin,
  projectsFindOneAdmin,
  projectsRemoveAdmin,
  projectsUpdateAdmin,
  type UpdateProjectDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useProjectsAdmin() {
  return useQuery({
    queryKey: queryKeys.projectsAdmin(),
    queryFn: () =>
      projectsFindAllAdmin({ throwOnError: true }).then((res) => res.data),
  });
}

export function useProjectAdmin(projectId: number) {
  return useQuery({
    queryKey: queryKeys.projectAdmin(projectId),
    queryFn: () =>
      projectsFindOneAdmin({
        path: { id: projectId },
        throwOnError: true,
      }).then((res) => res.data),
  });
}

function useInvalidateProjects(actionId: number) {
  const queryClient = useQueryClient();
  return (params?: { includeDetails: boolean }) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey:
          params?.includeDetails === false
            ? queryKeys.projectsAdmin()
            : queryKeys.projectsAdminAll(),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.actionAdmin(actionId),
      }),
    ]);
}

export function useAssignActionProjectAdmin(params: {
  actionId: number;
  onError: (err: Error) => void;
}) {
  const { actionId, onError } = params;
  const invalidate = useInvalidateProjects(actionId);
  return useMutation({
    mutationFn: (projectId: number | null) =>
      projectsAssignActionAdmin({
        path: { actionId },
        body: { projectId },
        throwOnError: true,
      }),
    onSuccess: () => invalidate(),
    onError,
  });
}

export function useCreateActionProjectAdmin(params: {
  actionId: number;
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const { actionId, onSuccess, onError } = params;
  const invalidate = useInvalidateProjects(actionId);
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: created } = await projectsCreateAdmin({
        body: { name },
        throwOnError: true,
      });
      await projectsAssignActionAdmin({
        path: { actionId },
        body: { projectId: created.id },
        throwOnError: true,
      });
    },
    onSuccess: async () => {
      await invalidate();
      onSuccess();
    },
    onError,
  });
}

export function useUpdateProjectAdmin(params: {
  actionId: number;
  onSuccess?: () => void;
  onError: (err: Error) => void;
}) {
  const { actionId, onSuccess, onError } = params;
  const invalidate = useInvalidateProjects(actionId);
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateProjectDto }) =>
      projectsUpdateAdmin({ path: { id }, body, throwOnError: true }),
    onSuccess: async () => {
      await invalidate();
      onSuccess?.();
    },
    onError,
  });
}

export function useDeleteProjectAdmin(params: {
  actionId: number;
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const { actionId, onSuccess, onError } = params;
  const invalidate = useInvalidateProjects(actionId);
  return useMutation({
    mutationFn: (id: number) =>
      projectsRemoveAdmin({ path: { id }, throwOnError: true }),
    onSuccess: async () => {
      onSuccess();
      // The deleted project's detail query would refetch into a 404.
      await invalidate({ includeDetails: false });
    },
    onError,
  });
}
