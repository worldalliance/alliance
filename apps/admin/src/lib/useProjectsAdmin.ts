import {
  type AdminProjectDto,
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

// Every action query shows the action's project, so a project write refetches them all.
function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return (params?: { includeDetails: boolean }) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey:
          params?.includeDetails === false
            ? queryKeys.projectsAdmin()
            : queryKeys.projectsAdminAll(),
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.actionAdminAll() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.actionsAllAdmin() }),
    ]);
}

export function useAssignActionProjectAdmin(params: {
  onError: (err: Error) => void;
}) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (assignment: { actionId: number; projectId: number | null }) =>
      projectsAssignActionAdmin({
        path: { actionId: assignment.actionId },
        body: { projectId: assignment.projectId },
        throwOnError: true,
      }),
    onSuccess: () => invalidate(),
    onError: params.onError,
  });
}

export function useCreateProjectAdmin(params: {
  onSuccess: (created: AdminProjectDto) => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: async (input: { name: string; actionId?: number }) => {
      const { data: created } = await projectsCreateAdmin({
        body: { name: input.name },
        throwOnError: true,
      });
      if (input.actionId !== undefined) {
        await projectsAssignActionAdmin({
          path: { actionId: input.actionId },
          body: { projectId: created.id },
          throwOnError: true,
        });
      }
      return created;
    },
    onSuccess: async (created) => {
      await invalidate();
      onSuccess(created);
    },
    onError,
  });
}

export function useUpdateProjectAdmin(params: {
  onSuccess?: () => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const invalidate = useInvalidateProjects();
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
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const invalidate = useInvalidateProjects();
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
