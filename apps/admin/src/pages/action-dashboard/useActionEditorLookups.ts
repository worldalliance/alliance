import { useMembers } from "@alliance/shared/lib/useMembers";
import { useSelectableUsers } from "@alliance/sharedweb/ui/UserSelect";
import { useMemo } from "react";
import { useActionSuitesAdmin } from "../../lib/useActionSuitesAdmin";
import { useAllActions } from "../../lib/useAllActions";
import { useTagsAdmin } from "../../lib/useTagsAdmin";

export function useActionEditorLookups() {
  const { allActions, allActionsLoading, allActionsLoadFailed } =
    useAllActions();
  const {
    tags: availableTags,
    isLoading: tagsLoading,
    isLoadingError: tagsError,
  } = useTagsAdmin();
  const {
    suites: {
      data: availableSuites,
      isPending: suitesLoading,
      isLoadingError: suitesError,
    },
  } = useActionSuitesAdmin();
  const {
    users: availableUsers,
    isLoading: usersLoading,
    isLoadingError: usersError,
  } = useSelectableUsers();
  const { data: members } = useMembers();
  const activeContractUserIds = useMemo(
    () =>
      new Set(
        (members ?? []).filter((m) => m.hasActiveContract).map((m) => m.id),
      ),
    [members],
  );
  return {
    availableTags,
    tagsLoading,
    tagsError,
    availableSuites,
    suitesLoading,
    suitesError,
    availableUsers,
    usersLoading,
    usersError,
    activeContractUserIds,
    allActions,
    allActionsLoading,
    allActionsLoadFailed,
  };
}
