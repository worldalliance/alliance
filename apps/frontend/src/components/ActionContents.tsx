import AppMarkdownWrapper from "@alliance/shared/ui/AppMarkdownWrapper";
import { Outlet, useOutletContext } from "react-router";
import { TaskPanelContext } from "./ActionPageTaskPanel";
import Comments from "./Comments";
import { getLastAndNextEvent } from "../pages/app/LargeActionCard";
import TaskTimeInfo from "../pages/app/TaskTimeInfo";
import ActionEventsPanel from "./ActionEventsPanel";

const ActionContents = () => {
  const context = useOutletContext<TaskPanelContext>();

  const action = context.action;

  if (!action) {
    return null;
  }

  const { lastEvent, nextEvent } = getLastAndNextEvent(action);

  return (
    <div className="flex flex-col gap-y-3 flex-2 w-full">
      {action?.image && (
        <img
          src={action.image}
          className="w-full h-auto rounded-md border border-gray-300 max-h-[200px] object-cover mb-5"
        />
      )}

      <div className="flex flex-row justify-between items-start mb-4 sm:mb-8">
        {action !== undefined && (
          <div className="flex flex-col gap-y-2">
            <p className="font-semibold text-3xl sm:text-[2.5rem] font-serif mb-2">
              {action.name}
            </p>
            <p className="">{action.shortDescription}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-y-8 sm:gap-y-12">
        <div className="">
          <ActionEventsPanel action={action} events={action.events} />
        </div>
        <div className="flex flex-col">
          <div className="flex flex-row justify-between items-center mb-4">
            <p className="font-semibold text-xl">Task</p>

            <TaskTimeInfo
              action={action}
              nextEvent={nextEvent}
              lastEvent={lastEvent}
            />
          </div>

          <Outlet context={context} />
        </div>

        <div>
          <p className="font-bold text-xl mb-4">Description</p>
          <AppMarkdownWrapper markdownContent={action?.body} />
        </div>

        <div>
          <p className="font-bold text-xl mb-4">Discussion</p>
          <p className="mb-8">
            Questions and comments about this action that other members would
            find helpful.
          </p>
          <Comments objectId={action.id} type={"action"} />
        </div>
      </div>
    </div>
  );
};

export default ActionContents;
