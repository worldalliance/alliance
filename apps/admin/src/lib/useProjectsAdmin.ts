import {
  projectsFindAllAdmin,
  projectsFindOneAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

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
