import {
  type FormulaDto,
  type SaveFormulasDto,
  formulasListAdmin,
  formulasSaveAdmin,
  formulasVersionsAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useFormulasAdmin() {
  return useQuery({
    queryKey: queryKeys.formulasAdmin(),
    queryFn: () =>
      formulasListAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

/** Keyed on the latest version, so a save that adds one never shows the cached list without it. */
export function useFormulaVersionsAdmin({
  formula: { id, versionId },
  enabled,
}: {
  formula: Pick<FormulaDto, "id" | "versionId">;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.formulaVersionsAdmin(id, versionId),
    queryFn: () =>
      formulasVersionsAdmin({ path: { id }, throwOnError: true }).then(
        (r) => r.data,
      ),
    enabled,
  });
}

/** Resolves to the problems that refused the save, empty once saved. */
export function useSaveFormulasAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveFormulasDto) =>
      formulasSaveAdmin({ body, throwOnError: true }).then(
        (r) => r.data.problems,
      ),
    // A save can fix a partition's part, or change how its conditions print.
    onSuccess: (problems) =>
      problems.length > 0
        ? undefined
        : queryClient.invalidateQueries({
            queryKey: queryKeys.suitePartitionsAdminAll(),
          }),
  });
}

export function useInvalidateFormulasAdmin() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.formulasAdmin() });
}

/** Drops a deleted formula from the cached list, so the list page never shows it. */
export function useForgetFormulaAdmin() {
  const queryClient = useQueryClient();
  return (id: string) =>
    queryClient.setQueryData<FormulaDto[]>(queryKeys.formulasAdmin(), (list) =>
      list?.filter((formula) => formula.id !== id),
    );
}
