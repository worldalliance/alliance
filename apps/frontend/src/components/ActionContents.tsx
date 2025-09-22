import AppMarkdownWrapper from "@alliance/shared/ui/AppMarkdownWrapper";
import { Outlet, useOutletContext } from "react-router";
import { useActionLoaderData } from "../pages/app/ActionPage";
import { TaskPanelContext } from "./ActionPageTaskPanel";
import Comments from "./Comments";

const ActionContents = () => {
  const context = useOutletContext<TaskPanelContext>();
  const action = useActionLoaderData();
  if (!action) {
    return null;
  }

  return (
    <div className="flex flex-col gap-y-3 flex-2 md:pl-10 pt-5 mb-24 w-full">
      {action?.image && (
        <img
          src={action.image}
          className="w-full h-auto rounded-md border border-gray-300 max-h-[200px] object-cover mb-5"
        />
      )}
      <div className="flex flex-row justify-between items-start mb-2">
        <div className="flex flex-col gap-y-3">
          {action !== undefined && (
            <h1 className="font-serif !font-semibold">{action.name}</h1>
          )}
        </div>
      </div>

      <Outlet context={context} />

      <AppMarkdownWrapper markdownContent={action?.body} className="my-4" />

      <Comments objectId={action.id} type={"action"} />
    </div>
  );
};

export default ActionContents;
