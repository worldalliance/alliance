import { FilterMode } from "@alliance/shared/lib/actionUtils";
import DropdownSelect from "@alliance/sharedweb/ui/DropdownSelect";
import { useMemo, useState } from "react";
import {
  filterActions,
  useActionsQuery,
} from "@alliance/shared/lib/actionsListPage";
import ActionItemCard from "../../components/ActionItemCard";
import { useGrayBackground } from "../../components/HtmlBackgroundManager";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { ActionDto } from "@alliance/shared/client";
import { href, Link } from "react-router";

const ActionsListPage = () => {
  const { data: actions, isPending } = useActionsQuery();

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
      <div className="flex flex-row justify-between w-full items-center">
        <div className="flex flex-row justify-start items-center w-full gap-x-4">
          <p>Filter by:</p>
          <DropdownSelect
            options={FilterMode}
            secondaryLabel={([, mode]) => modeToActions[mode].length.toString()}
            value={filterMode}
            onChange={([, mode]) => setUserFilterMode(mode)}
          />
        </div>
        <Link
          to={href("/action-updates")}
          className="text-zinc-800 hover:underline rounded font-medium whitespace-nowrap"
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
            {isPending ? (
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
