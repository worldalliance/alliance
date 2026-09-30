import { ActionDto } from "@alliance/shared/client";
import {
  filterActions,
  useActionsQuery,
} from "@alliance/shared/lib/actionsListPage";
import { FilterMode } from "@alliance/shared/lib/actionUtils";
import { failedToLoad } from "@alliance/shared/lib/failedToLoad";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import DropdownSelect from "@alliance/sharedweb/ui/DropdownSelect";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { ChevronRight, Newspaper } from "lucide-react";
import { useMemo, useState } from "react";
import { href, Link } from "react-router";
import ActionItemCard from "../../components/ActionItemCard";
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
      <div className="flex flex-row flex-wrap justify-between w-full items-center gap-2">
        <div className="flex flex-row justify-start items-center gap-x-4">
          <p>Filter by:</p>
          <DropdownSelect
            options={FilterMode}
            secondaryLabel={([, mode]) =>
              didFail ? undefined : modeToActions[mode].length.toString()
            }
            value={filterMode}
            onChange={([, mode]) => setUserFilterMode(mode)}
          />
        </div>
        <Link
          to={href("/action-updates")}
          className="ml-auto flex flex-row items-center gap-x-3 bg-white border border-zinc-200 rounded-[7px] px-3 py-2 hover:border-zinc-300 hover:bg-zinc-50"
        >
          <Newspaper size={20} className="shrink-0 text-zinc-700" />
          <div className="flex flex-col">
            <span className="font-medium text-zinc-900 whitespace-nowrap">
              Action updates
            </span>
            <span className="text-xs text-zinc-500 whitespace-nowrap">
              <span className="hidden md:inline">
                Short posts about what we achieved
              </span>
              <span className="md:hidden">What we achieved</span>
            </span>
          </div>
          <ChevronRight size={16} className="shrink-0 text-zinc-400" />
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
