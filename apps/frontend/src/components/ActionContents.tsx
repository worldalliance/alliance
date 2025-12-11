import AppMarkdownWrapper from "@alliance/shared/ui/AppMarkdownWrapper";
import { Link, Outlet, href, useOutletContext } from "react-router";
import chevronLeft from "../assets/icons8-expand-arrow-96.png";
import { useAuth } from "../lib/AuthContext";
import { getLastAndNextEvent } from "../pages/app/LargeActionCard";
import TaskTimeInfo from "../pages/app/TaskTimeInfo";
import ActionEventsPanel from "./ActionEventsPanel";
import { TaskPanelContext } from "./ActionPageTaskPanel";
import Comments from "./Comments";

const ActionContents = () => {
  const context = useOutletContext<TaskPanelContext>();

  const action = context.action;

  const { isAuthenticated, loading } = useAuth();
  const loggedInMode = isAuthenticated || loading;

  if (!action) {
    return null;
  }

  const { lastEvent, nextEvent } = getLastAndNextEvent(action);

  return (
    <div className="flex flex-col gap-y-3 flex-2 w-full justify-center">
      {action?.image && (
        <img
          src={action.image}
          className="w-full h-auto rounded-md border border-gray-300 max-h-[200px] object-cover mb-5"
        />
      )}

      <div className="flex flex-row justify-between items-start mb-4 sm:mb-8">
        {action !== undefined && (
          <div className="flex flex-col gap-y-2">
            <p className="font-semibold text-3xl font-serif mb-2">
              {action.name}
            </p>
            {loggedInMode ? (
              <p className="">{action.shortDescription}</p>
            ) : (
              <TaskTimeInfo
                action={action}
                nextEvent={nextEvent}
                lastEvent={lastEvent}
                absoluteDeadline={true}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-y-8 sm:gap-y-12">
        {loggedInMode && <ActionEventsPanel action={action} />}
        {action.status !== "planned" && (
          <Link
            to={href("/feed/:actionId", { actionId: action.id.toString() })}
            className="self-start flex flex-row items-center gap-x-1 md:hidden border border-zinc-200 hover:bg-zinc-50 px-2 py-1 rounded"
          >
            <p className="font-medium text-sm">Activity</p>
            <img src={chevronLeft} className="w-3 h-3 rotate-270" />
          </Link>
        )}
        {action.status !== "planned" && (
          <div className="flex flex-col">
            {loggedInMode && (
              <div className="flex flex-col lg:flex-row justify-between lg:items-center mb-4 gap-x-4">
                <p className="font-semibold text-xl flex-1">Task</p>

                <TaskTimeInfo
                  action={action}
                  nextEvent={nextEvent}
                  lastEvent={lastEvent}
                  absoluteDeadline={true}
                />
              </div>
            )}
            <Outlet context={context} />
          </div>
        )}
        {loggedInMode && (
          <>
            <div>
              <p className="font-semibold text-xl mb-4">Description</p>
              <AppMarkdownWrapper markdownContent={action?.body} />
            </div>

            <div>
              <p className="font-semibold text-xl mb-4">Discussion</p>
              <p className="mb-8">
                Questions and comments about this action that other members
                would find helpful.
              </p>
              <Comments objectId={action.id} type={"action"} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ActionContents;
