import { useEffect, useState } from "react";
import { tasksGetForm, tasksGetMyFormResponse } from "../client/sdk.gen";
import { ActionDto, FormDto, FormResponseDto } from "../client/types.gen";

export const useCompletedTaskForm = (
  action: Pick<ActionDto, "taskFormId"> | null,
  enabled = true,
) => {
  const [formResponse, setFormResponse] = useState<FormResponseDto | null>(
    null,
  );

  useEffect(() => {
    if (!enabled || !action?.taskFormId) {
      setFormResponse(null);
      return;
    }

    let cancelled = false;

    const fetchFormAndResponse = async (id: number) => {
      try {
        const response = await tasksGetMyFormResponse({
          path: { id },
        });
        if (!cancelled) {
          setFormResponse(response.data ?? null);
        }
      } catch {
        if (!cancelled) {
          setFormResponse(null);
        }
      }
    };

    void fetchFormAndResponse(action.taskFormId);

    return () => {
      cancelled = true;
    };
  }, [action, enabled]);

  return formResponse;
};

export const useTaskForm = (
  action: Pick<ActionDto, "taskFormId"> | null,
  enabled = true,
) => {
  const [taskForm, setTaskForm] = useState<FormDto | null>(null);

  useEffect(() => {
    if (!enabled || !action?.taskFormId) {
      setTaskForm(null);
      return;
    }

    let cancelled = false;

    const fetchTaskForm = async (id: number) => {
      try {
        const response = await tasksGetForm({
          path: { id },
        });
        if (!cancelled) {
          setTaskForm(response.data ?? null);
        }
      } catch {
        if (!cancelled) {
          setTaskForm(null);
        }
      }
    };

    void fetchTaskForm(action.taskFormId);

    return () => {
      cancelled = true;
    };
  }, [action, enabled]);

  return taskForm;
};
