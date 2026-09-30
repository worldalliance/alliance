import { ActionDto } from "@alliance/shared/client";
import {
  filterActions,
  useActionsQuery,
} from "@alliance/shared/lib/actionsListPage";
import { FilterMode } from "@alliance/shared/lib/actionUtils";
import { failedToLoad } from "@alliance/shared/lib/failedToLoad";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useMemo, useState } from "react";
import { href, Link } from "react-router";
import ActionItemCard from "../../components/ActionItemCard";
import ActionsFilterBar from "../../components/ActionsFilterBar";
import { useGrayBackground } from "../../components/HtmlBackgroundManager";
import LoadFailed from "../../components/LoadFailed";

const ActionsListPage = () => {
  const actionsQuery = useActionsQuery();
  const { data: actions, isPending, isFetching, refetch } = actionsQuery;
  const didFail = failedToLoad(actionsQuery);

  const [userFilterMode, setUserFilterMode] = useState<FilterMode | null>(null);

  const modeToActions: Record<FilterMode, ActionDto[]> = useMemo(() => {
    return Object.values(FilterMode).reduce(
      (acc, mode) => {
        acc[mode] = filterActions(actions ?? [], mode);
        return acc;
      },
      {} as Record<FilterMode, ActionDto[]>,
    );
  }, [actions]);

  const filterMode =
    userFilterMode ??
    (modeToActions[FilterMode.CompletedByMe].length > 0
      ? FilterMode.CompletedByMe
      : FilterMode.All);

  useGrayBackground();

  const filteredActions = useMemo(
    () => [...modeToActions[filterMode]],
    [modeToActions, filterMode],
  );

  return (
    <CenterLayout className="gap-y-4" width="4xl">
      <div className="flex flex-row flex-wrap justify-between w-full items-center gap-x-4 gap-y-2">
        <ActionsFilterBar
          value={filterMode}
          onChange={setUserFilterMode}
          shownCount={didFail ? undefined : filteredActions.length}
        />
        <Link
          to={href("/action-updates")}
          className="ml-auto text-zinc-800 hover:underline rounded font-medium whitespace-nowrap"
        >
          Action updates
        </Link>
      </div>

      <div className="w-full flex flex-col gap-y-2 *:bg-white">
        {filteredActions.map((action) => (
          <ActionItemCard key={action.id} action={action} className="w-full " />
        ))}
        {filteredActions.length === 0 && (
          <>
            {didFail ? (
              <LoadFailed
                message="Couldn't load actions."
                onRetry={() => void refetch()}
                retrying={isFetching}
              />
            ) : isPending ? (
              <div className="flex items-center justify-center py-5">
                <Spinner size="large" />
              </div>
            ) : (
              <p className="text-center text-zinc-500 py-5">
                No matching actions
              </p>
            )}
          </>
        )}
      </div>
    </CenterLayout>
  );
};

export default ActionsListPage;
