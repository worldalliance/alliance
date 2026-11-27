import type {
  ActionUpdateDto,
  AdminActionListItemDto,
  AdminProjectDto,
} from "@alliance/shared/client";
import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { groupBy } from "es-toolkit";
import { useMemo } from "react";
import { LOAD_FAILED_FALLBACK } from "../ui/templates/States";
import { adminRefusalMessage } from "./adminRefusal";
import type { CohortSegment } from "./describeCohortExpression";
import { useActionParticipants } from "./useActionParticipants";
import { useAllActionUpdatesAdmin } from "./useAllActionUpdatesAdmin";
import { useProjectsAdmin } from "./useProjectsAdmin";

export enum ProjectsLoad {
  Pending = "pending",
  Failed = "failed",
  Ready = "ready",
}

type ProjectsLoadState =
  | { load: ProjectsLoad.Pending }
  | { load: ProjectsLoad.Failed; error: string }
  | {
      load: ProjectsLoad.Ready;
      actions: AdminActionListItemDto[];
      projects: AdminProjectDto[];
      participantsById: ReadonlyMap<number, CohortSegment[]>;
    };

const withUpdates = (params: {
  actions: AdminActionListItemDto[];
  updates: ActionUpdateDto[];
}): AdminActionListItemDto[] => {
  const byAction = groupBy(params.updates, (update) => update.actionId);
  return params.actions
    .filter((action) => !action.archived)
    .map((action) => ({ ...action, updates: byAction[action.id] ?? [] }));
};

/**
 * Non-archived actions and every project, for the projects pages. Only a
 * first load that fails is `Failed`: a failed refetch keeps what loaded, and
 * the queries say so.
 */
export function useProjectsPageData() {
  const actionsQuery = useActionsAdmin();
  const projectsQuery = useProjectsAdmin();
  // GET /actions/all leaves `updates` empty; the flags read them.
  const updatesQuery = useAllActionUpdatesAdmin();
  const actions = useMemo(
    () =>
      withUpdates({
        actions: actionsQuery.data ?? [],
        updates: updatesQuery.data ?? [],
      }),
    [actionsQuery.data, updatesQuery.data],
  );
  const participantsById = useActionParticipants(actions);
  const queries = [actionsQuery, projectsQuery, updatesQuery];
  const failed = queries.find((query) => query.isLoadingError);

  const state = ((): ProjectsLoadState => {
    if (failed) {
      return {
        load: ProjectsLoad.Failed,
        error: adminRefusalMessage(failed.error, LOAD_FAILED_FALLBACK),
      };
    }
    if (
      actionsQuery.data === undefined ||
      projectsQuery.data === undefined ||
      updatesQuery.data === undefined
    ) {
      return { load: ProjectsLoad.Pending };
    }
    return {
      load: ProjectsLoad.Ready,
      actions,
      projects: projectsQuery.data,
      participantsById,
    };
  })();

  return {
    ...state,
    actionsQuery,
    projectsQuery,
    updatesQuery,
    retry: () => {
      for (const query of queries) if (query.isError) void query.refetch();
    },
    retrying: queries.some((query) => query.isFetching),
  };
}

export type ProjectsPageData = ReturnType<typeof useProjectsPageData>;
