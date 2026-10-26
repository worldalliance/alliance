import { errorMessage } from "@alliance/common/errorMessage";
import type {
  AdminActionListItemDto,
  AdminProjectDto,
} from "@alliance/shared/client";
import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { useMemo } from "react";
import { actionsLoadError } from "./actionsLoadError";
import type { CohortSegment } from "./describeCohortExpression";
import { useActionParticipants } from "./useActionParticipants";
import { useProjectsAdmin } from "./useProjectsAdmin";

export enum ProjectsLoad {
  Pending = "pending",
  Failed = "failed",
  Ready = "ready",
}

export type ProjectsPageData =
  | { load: ProjectsLoad.Pending }
  | { load: ProjectsLoad.Failed; error: string }
  | {
      load: ProjectsLoad.Ready;
      actions: AdminActionListItemDto[];
      projects: AdminProjectDto[];
      participantsById: ReadonlyMap<number, CohortSegment[]>;
    };

/** Non-archived actions and every project, for the projects pages. */
export function useProjectsPageData(): ProjectsPageData {
  const actionsQuery = useActionsAdmin();
  const projectsQuery = useProjectsAdmin();
  const actions = useMemo(
    () => (actionsQuery.data ?? []).filter((action) => !action.archived),
    [actionsQuery.data],
  );
  const participantsById = useActionParticipants(actions);

  if (actionsQuery.isError) {
    return {
      load: ProjectsLoad.Failed,
      error: actionsLoadError(actionsQuery.error),
    };
  }
  if (projectsQuery.isError) {
    return {
      load: ProjectsLoad.Failed,
      error: errorMessage({
        error: projectsQuery.error,
        fallback: "Could not load projects",
      }),
    };
  }
  if (actionsQuery.isPending || projectsQuery.isPending) {
    return { load: ProjectsLoad.Pending };
  }
  return {
    load: ProjectsLoad.Ready,
    actions,
    projects: projectsQuery.data,
    participantsById,
  };
}
