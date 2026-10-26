import { eventInEffectAt } from "@alliance/common/actionEvent";
import { ActionDto } from "@alliance/shared/client";
import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import React, { useMemo, useState } from "react";
import ActionSpotlight from "../components/ActionSpotlight";
import ActionStatusBucketFilter from "../components/ActionStatusBucketFilter";
import ActionTimeline from "../components/ActionTimeline";
import CreateActionMenu from "../components/CreateActionMenu";
import {
  ActionStatusBucket,
  actionStatusBucket,
} from "../lib/actionStatusBucket";
import { actionsLoadError } from "../lib/actionsLoadError";
import { useActionParticipants } from "../lib/useActionParticipants";

export const getLastPastEventDate = (
  action: Pick<ActionDto, "events">,
): Date | null => {
  const { event } = eventInEffectAt(action.events, new Date());
  return event ? new Date(event.date) : null;
};

const ActionsList: React.FC = () => {
  const list = useActionsAdmin();
  const actions = useMemo(
    () => (list.data ?? []).filter((action) => !action.archived),
    [list.data],
  );
  const error = list.isError ? actionsLoadError(list.error) : null;
  const [shownBuckets, setShownBuckets] = useState<
    ReadonlySet<ActionStatusBucket>
  >(
    () =>
      new Set([
        ActionStatusBucket.Active,
        ActionStatusBucket.Pending,
        ActionStatusBucket.Draft,
      ]),
  );
  const [focusAction, setFocusAction] = useState<{ id: number } | null>(null);
  const participantsById = useActionParticipants(actions);

  if (list.isPending) {
    return <p>Loading actions...</p>;
  }

  if (error && !list.data) {
    return <p className="text-red-500">{error}</p>;
  }

  if (actions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="font-bold ml-2">Actions</p>
          <CreateActionMenu />
        </div>
        {error && <p className="text-red-500">{error}</p>}
        <p>No actions found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen p-5 gap-y-3">
      <title>Admin panel</title>
      {error && <p className="text-red-500 flex-shrink-0">{error}</p>}
      <ActionSpotlight
        actions={actions}
        onPick={(action) => {
          setShownBuckets((shown) =>
            new Set(shown).add(actionStatusBucket(action)),
          );
          setFocusAction({ id: action.id });
        }}
      />
      <ActionTimeline
        actions={actions.filter((action) =>
          shownBuckets.has(actionStatusBucket(action)),
        )}
        header={
          <div className="flex h-full items-center gap-x-2">
            <ActionStatusBucketFilter
              selected={shownBuckets}
              onChange={setShownBuckets}
            />
            <CreateActionMenu />
          </div>
        }
        latestLaunchFirst
        participantsById={participantsById}
        focusAction={focusAction}
        className="flex-1 min-h-0 border border-zinc-200"
      />
    </div>
  );
};

export default ActionsList;
