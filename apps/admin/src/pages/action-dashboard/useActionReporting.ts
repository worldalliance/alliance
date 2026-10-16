import {
  actionsGetIncompleteUsersAdmin,
  actionsShareUrlStatsAdmin,
  analyticsGetActionStatsByIdAdmin,
  FormResponseDto,
  tasksGetForm,
  tasksGetFormResponsesAdmin,
} from "@alliance/shared/client";
import type {
  ActionStatsWithOnboardingDto,
  ActionStatus,
  ProfileDto,
  ShareUrlStatsDto,
} from "@alliance/shared/client/types.gen";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { useEffect, useState } from "react";
import type { FormWithSchema } from "../../components/FormResponsesView";

export type ActionReporting = ReturnType<typeof useActionReporting>;

export function useActionReporting(
  action: ParsedActionDto | null,
  actionId: number | null,
) {
  const [shareUrlStats, setShareUrlStats] = useState<ShareUrlStatsDto[]>([]);
  const [shareUrlStatsLoading, setShareUrlStatsLoading] = useState(false);
  const [actionStats, setActionStats] =
    useState<ActionStatsWithOnboardingDto | null>(null);
  const [taskForm, setTaskForm] = useState<FormWithSchema | null>(null);
  const [formResponses, setFormResponses] = useState<FormResponseDto[]>([]);
  const [incompleteUsers, setIncompleteUsers] = useState<ProfileDto[]>([]);

  useEffect(() => {
    if (!action || !action.publicOnly || !actionId) {
      setShareUrlStats([]);
      return;
    }

    const loadShareUrlStats = async () => {
      setShareUrlStatsLoading(true);
      try {
        const response = await actionsShareUrlStatsAdmin({
          path: { actionId },
          query: { questionId: "field-1765411401186" },
        });
        if (response.data) {
          setShareUrlStats(response.data);
        }
      } catch (err) {
        console.error("Failed to load share URL stats:", err);
      } finally {
        setShareUrlStatsLoading(false);
      }
    };

    loadShareUrlStats();
  }, [action, actionId]);

  useEffect(() => {
    if (!actionId) {
      setActionStats(null);
      return;
    }

    const loadActionStats = async () => {
      try {
        const response = await analyticsGetActionStatsByIdAdmin({
          path: { actionId: actionId.toString() },
        });
        setActionStats(response.data ?? null);
      } catch (err) {
        console.error("Failed to load action stats:", err);
      }
    };

    loadActionStats();
  }, [actionId]);

  useEffect(() => {
    if (!action?.taskFormId) {
      setTaskForm(null);
      setFormResponses([]);
      return;
    }

    const loadFormData = async () => {
      try {
        const [formRes, respRes] = await Promise.all([
          tasksGetForm({ path: { id: action.taskFormId! } }),
          tasksGetFormResponsesAdmin({ path: { id: action.taskFormId! } }),
        ]);
        if (formRes.data) {
          setTaskForm(formRes.data as unknown as FormWithSchema);
        }
        if (respRes.data) {
          setFormResponses(respRes.data);
        }
      } catch (err) {
        console.error("Failed to load form responses:", err);
      }
    };

    loadFormData();
  }, [action?.taskFormId]);

  useEffect(() => {
    const doneStatuses: ActionStatus[] = [
      "completed",
      "failed",
      "abandoned",
      "resolution",
      "office_action",
    ];
    if (!actionId || !action?.status || !doneStatuses.includes(action.status)) {
      setIncompleteUsers([]);
      return;
    }

    const loadIncompleteUsers = async () => {
      try {
        const response = await actionsGetIncompleteUsersAdmin({
          path: { id: actionId },
        });
        setIncompleteUsers(response.data ?? []);
      } catch (err) {
        console.error("Failed to load incomplete users:", err);
      }
    };

    loadIncompleteUsers();
  }, [actionId, action?.status]);

  return {
    shareUrlStats,
    shareUrlStatsLoading,
    actionStats,
    taskForm,
    formResponses,
    incompleteUsers,
  };
}
