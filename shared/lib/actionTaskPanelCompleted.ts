import { useQuery } from "@tanstack/react-query";
import {
  tasksGetForm,
  tasksGetGuestFormResponse,
  tasksGetMyFormResponse,
} from "../client/sdk.gen";
import { ActionDto, FormDto, FormResponseDto } from "../client/types.gen";

export const useCompletedTaskForm = (
  action: Pick<ActionDto, "taskFormId"> | null,
  enabled = true,
): FormResponseDto | null => {
  const taskFormId = action?.taskFormId ?? null;
  const { data } = useQuery({
    queryKey: ["taskFormResponse", taskFormId],
    queryFn: async () => {
      const response = await tasksGetMyFormResponse({
        path: { id: taskFormId! },
      });
      return response.data ?? null;
    },
    enabled: enabled && taskFormId != null,
    retry: false,
  });

  return data ?? null;
};

export const useGuestTaskForm = (
  action: Pick<ActionDto, "taskFormId"> | null,
  enabled = true,
): FormResponseDto | null => {
  const taskFormId = action?.taskFormId ?? null;
  const { data } = useQuery({
    queryKey: ["guestTaskFormResponse", taskFormId],
    queryFn: async () => {
      const response = await tasksGetGuestFormResponse({
        path: { id: taskFormId! },
      });
      return response.data?.response ?? null;
    },
    enabled: enabled && taskFormId != null,
    retry: false,
  });

  return data ?? null;
};

export const useTaskForm = (
  action: Pick<ActionDto, "taskFormId"> | null,
  enabled = true,
): FormDto | null => {
  const taskFormId = action?.taskFormId ?? null;
  const { data } = useQuery({
    queryKey: ["taskForm", taskFormId],
    queryFn: async () => {
      const response = await tasksGetForm({
        path: { id: taskFormId! },
      });
      return response.data ?? null;
    },
    enabled: enabled && taskFormId != null,
    retry: false,
  });

  return data ?? null;
};
