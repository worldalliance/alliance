import {
  actionsUpdateAdmin,
  type AdminActionDto,
  type AdminProjectDto,
  type CreateProjectActionDto,
  projectActionsCreateAdmin,
  projectActionsRescheduleReleaseAdmin,
  projectActionsScheduleReleaseAdmin,
  projectActionsUnscheduleReleaseAdmin,
  projectsAssignActionAdmin,
  projectsCreateAdmin,
  projectsFindAllAdmin,
  projectsFindOneAdmin,
  projectsRemoveAdmin,
  projectsUpdateAdmin,
  type RescheduleReleaseDto,
  type ScheduleReleaseDto,
  type UpdateProjectDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dataOrThrow,
  sendConfirmingDeadlineShortening,
} from "./confirmDeadlineShortening";

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

export function useCreateProjectActionAdmin(params: {
  onSuccess: (created: AdminActionDto) => void;
}) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: { projectId: number; body: CreateProjectActionDto }) =>
      projectActionsCreateAdmin({
        path: { projectId: input.projectId },
        body: input.body,
        throwOnError: true,
      }).then((res) => res.data),
    onSuccess: (created) => {
      void invalidate();
      params.onSuccess(created);
    },
  });
}

export function useActionReleaseAdmin(actionId: number) {
  const invalidate = useInvalidateProjects();
  const schedule = useMutation({
    mutationFn: (body: ScheduleReleaseDto) =>
      projectActionsScheduleReleaseAdmin({
        path: { id: actionId },
        body,
        throwOnError: true,
      }),
    onSuccess: () => invalidate(),
  });
  const { confirm } = useToast();
  const reschedule = useMutation({
    mutationFn: (body: RescheduleReleaseDto) =>
      sendConfirmingDeadlineShortening({
        send: (query) =>
          projectActionsRescheduleReleaseAdmin({
            path: { id: actionId },
            body,
            query,
          }),
        confirm,
      }).then(dataOrThrow),
    onSuccess: () => invalidate(),
  });
  const unschedule = useMutation({
    mutationFn: () =>
      projectActionsUnscheduleReleaseAdmin({
        path: { id: actionId },
        throwOnError: true,
      }),
    onSuccess: () => invalidate(),
  });
  return { schedule, reschedule, unschedule };
}

export function useStartStaffTestingAdmin(params: {
  onError: (err: Error) => void;
}) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (actionId: number) =>
      actionsUpdateAdmin({
        path: { id: actionId },
        body: { staffPreview: true },
        throwOnError: true,
      }),
    onSuccess: () => invalidate(),
    onError: params.onError,
  });
}
