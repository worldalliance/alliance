import {
  ActionDto,
  actionsFindOne,
  actionsMyStatus,
  UserActionRelation,
} from "@alliance/shared/client";
import { useEffect, useMemo, useState } from "react";
import {
  data,
  isRouteErrorResponse,
  Outlet,
  useLoaderData,
  useParams,
  useRouteLoaderData,
} from "react-router";
import { Route } from "../../../.react-router/types/src/pages/app/+types/ActionPage";
import ActionActivityList from "../../components/ActionActivityList";
import ActionEventsPanel from "../../components/ActionEventsPanel";
import { TaskPanelContext } from "../../components/ActionPageTaskPanel";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import { useAuth } from "../../lib/AuthContext";
import { testActions } from "../../stories/testData";
import useActivities, { ActivityList } from "./useActivities";

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  console.error(error);
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div>
        <p className="font-bold pb-2">Could not load action</p>
        <p>
          {isRouteErrorResponse(error) && error.status === 404
            ? "Not found"
            : "API server is not responding. Please try again later."}
        </p>
      </div>
    </div>
  );
}

export async function loader({
  params,
}: Route.LoaderArgs): Promise<ActionDto | undefined> {
  if (!params.id || isNaN(parseInt(params.id))) {
    return undefined;
  }
  const action = await actionsFindOne({
    path: { id: parseInt(params.id) },
  });

  if (!action.data) {
    throw data("Record Not Found", { status: 404 });
  }

  return { ...action.data };
}

export function meta({ data }: Route.MetaArgs) {
  const action = data as ActionDto | undefined;
  if (!action) {
    return [{ title: "Alliance" }];
  }
  return [
    { title: action.name },
    { name: "description", content: action.shortDescription },
  ];
}

export default function ActionPage() {
  const { id: idParam } = useParams();

  useWhiteBackground();

  const loaderData = useLoaderData<typeof loader>();

  const action = useMemo(() => {
    if (import.meta.env.STORYBOOK) {
      return { ...testActions[0], locations: [] };
    }
    return loaderData;
  }, [loaderData]);
  const id = idParam || String(action?.id);

  const [userRelation, setUserRelation] = useState<UserActionRelation | null>(
    null
  );

  const { isAuthenticated } = useAuth();

  const actionId = action?.id || 0;

  //   const { activities: liveActivities } = useActionActivity(actionId);

  const { activities, handleLikeActivity, setActivities } = useActivities({
    list: ActivityList.Action,
    objectId: actionId,
  });

  useEffect(() => {
    if (isAuthenticated && id) {
      actionsMyStatus({
        path: { id },
      }).then((response) => {
        console.log("response", response);
        if (response.error) {
          console.error("Failed to fetch user status", response.error);
        }
        console.log("response", response);
        if (response.data) {
          setUserRelation(response.data.relation);
        }
      });
    }
  }, [isAuthenticated, id]);

  return (
    <div
      className="max-w-[1250px] mx-auto flex bg-white min-h-[calc(100vh-var(--nav-height))]"
      style={{ boxSizing: "border-box" }}
    >
      <div className="flex-1 p-10">
        <Outlet
          context={
            {
              userRelation,
              onCompleteAction: () => setUserRelation("completed"),
              onJoinAction: () => setUserRelation("joined"),
              onDeclineAction: () => setUserRelation("declined"),
              onOptOutAction: () => setUserRelation("declined"),
              activities,
              handleLikeActivity,
              setActivities,
            } satisfies TaskPanelContext
          }
        />
      </div>
      <div
        className="w-[360px] shrink-0 sticky top-[var(--nav-height)] self-start divide-y divide-zinc-200 hidden md:flex flex-col *:py-5 p-10 pt-14 border-l border-zinc-200 overflow-auto"
        style={{ height: `calc(100vh - var(--nav-height))` }}
      >
        {action && (
          <>
            <ActionEventsPanel action={action} events={action.events} />
            <ActionActivityList
              actionId={action.id}
              activities={activities}
              loading={false}
              onLikeActivity={handleLikeActivity}
              setActivities={setActivities}
              maxN={5}
            />
          </>
        )}
      </div>
    </div>
  );
}

export function useActionLoaderData() {
  const action = useRouteLoaderData<typeof loader>("pages/app/ActionPage"); //TODO: why is this based on file path
  if (!action) {
    throw new Error("No data - applayout loader not found");
  }
  return action;
}
