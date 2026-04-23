import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { tasksGetForm } from "@alliance/shared/client";
import type { ProfileDto } from "@alliance/shared/client/types.gen";
import {
  Link,
  Outlet,
  href,
  useLocation,
  useOutletContext,
} from "react-router";
import chevronLeft from "../assets/icons8-expand-arrow-96.png";
import { useAuth } from "../lib/AuthContext";
import { getNextEvent } from "@alliance/shared/lib/largeActionCard";
import { isFollowUpFormActive } from "@alliance/shared/lib/actionUtils";
import TaskTimeInfo from "../pages/app/TaskTimeInfo";
import ActionEventsPanel from "./ActionEventsPanel";
import FollowUpFormPanel from "./FollowUpFormPanel";
import { TaskPanelContext } from "./ActionPageTaskPanel";
import Comments from "./Comments";
import { shuffleWithSeed } from "@alliance/shared/forms/randomutils";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon } from "lucide-react";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import ActionCompletedBarWithInfo from "../pages/app/ActionCompletedBarWithInfo";
import AggregateProgressBarBlock from "@alliance/sharedweb/ui/AggregateProgressBarBlock";
import { useLiveTaskFormAggregateViews } from "../lib/useLiveTaskFormAggregateViews";
import { useCompletedTaskForm } from "@alliance/shared/lib/actionTaskPanelCompleted";
import {
  buildActionShareUrl,
  buildShareText,
  getCompletedShareableTextTemplate,
  getDefaultShareableTextTemplate,
} from "@alliance/shared/lib/shareText";
import { clipboardCopy } from "@alliance/shared/lib/copy";
import ShareButton from "./ShareButton";

const ActionContents = () => {
  const context = useOutletContext<TaskPanelContext>();
  const location = useLocation();

  const action = context.action;

  const aggregateViews = useLiveTaskFormAggregateViews(
    action.taskFormId,
    action.usersCompleted,
    context.userRelation,
  );

  const { user, isAuthenticated } = useAuth();
  const loggedInMode = !action.publicOnly;
  const isCompleted = context.userRelation === "completed";
  const formResponse = useCompletedTaskForm(action, isCompleted);
  const { data: taskForm } = useQuery({
    queryKey: ["form", action.taskFormId],
    queryFn: async () => {
      const response = await tasksGetForm({
        path: { id: action.taskFormId! },
      });

      if (!response.data) {
        throw new Error(
          (response.error as Error)?.message ??
            "Unable to load form - please reload",
        );
      }

      return response.data;
    },
    enabled: !isCompleted && action.taskFormId != null,
  });
  const shareTemplate = isCompleted
    ? getCompletedShareableTextTemplate({
        schemaSnapshot: formResponse?.schemaSnapshot as
          | Record<string, unknown>
          | undefined,
        currentSchema: taskForm?.schema as Record<string, unknown> | undefined,
      })
    : getDefaultShareableTextTemplate(
        taskForm?.schema as Record<string, unknown> | undefined,
      );

  useEffect(() => {
    if (location.hash === "#description") {
      const el = document.getElementById("description");
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }
  }, [location.hash]);

  const shuffledAuthors = useMemo(() => {
    if (!action.authors) {
      return [];
    }
    return shuffleWithSeed(action.authors, action.id.toString());
  }, [action.authors, action.id]);

  const activeFollowUpForms = useMemo(() => {
    if (context.userRelation !== "completed") {
      return [];
    }
    const list = action.followUpForms;
    return list.filter(isFollowUpFormActive);
    // dont want to show follow up before cohort recomputed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.followUpForms]);

  const progressViews = useMemo(
    () => aggregateViews.filter((view) => view.kind === "progressbar"),
    [aggregateViews],
  );

  if (!action) {
    return null;
  }

  const nextEvent = getNextEvent(action);

  const handleShareAction = async () => {
    const url = await buildActionShareUrl({
      actionId: action.id,
      baseUrl: getBaseUrl(),
      isAuthenticated,
    });
    const text = buildShareText({
      template: shareTemplate,
      formResponse,
      userName: user?.name,
      url,
    });
    return copyToClipboard(text);
  };

  return (
    <div className="flex flex-col gap-y-3 flex-2 w-full">
      {action?.image && (
        <img
          src={action.image}
          className="w-full h-auto rounded-md border border-zinc-300 max-h-[200px] object-cover mb-5"
        />
      )}

      <div className="flex flex-row justify-between items-start mb-6">
        {action !== undefined && (
          <div className="flex flex-col gap-y-3">
            <ShareButton
              onClick={handleShareAction}
              icon={ExternalLinkIcon}
              label={clipboardCopy.share}
              copiedLabel={clipboardCopy.copiedToClipboard}
              className="self-start text-zinc-500 hover:text-zinc-700"
              iconClassName="w-3.5 h-3.5 shrink-0"
              labelClassName="text-sm order-first"
            />
            <p className="text-title">{action.name}</p>
            {loggedInMode ? (
              <div>
                <p className="text-base md:text-lg">
                  {action.shortDescription}
                </p>
                {!!action.authors?.length && (
                  <div className="mt-1">
                    <div className="flex flex-row gap-x-1 text-zinc-500 text-base md:text-lg">
                      <p>By</p>
                      {shuffledAuthors.map((author: ProfileDto, i: number) => (
                        <span key={author.id} className="text-nowrap">
                          <Link
                            key={author.id}
                            to={href("/member/:id", {
                              id: author.id.toString(),
                            })}
                            className="underline"
                          >
                            {author.displayName}
                          </Link>
                          {i < action.authors!.length - 2 && ", "}
                          {i === action.authors!.length - 2 &&
                            `${action.authors!.length > 2 ? "," : ""} and `}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <TaskTimeInfo
                action={action}
                nextEvent={nextEvent}
                absoluteDeadline={true}
              />
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-y-8 sm:gap-y-12">
        {loggedInMode && <ActionEventsPanel action={action} />}
        {progressViews.length > 0 && (
          <div className="flex flex-col gap-y-4">
            {progressViews.map((view) => (
              <div
                key={view.id}
                className="bg-grey-0 rounded-md p-6 flex flex-col gap-y-2"
              >
                <AggregateProgressBarBlock
                  view={view}
                  titleClassName="font-semibold text-lg text-zinc-900"
                  captionClassName="text-sm text-zinc-600"
                  className="flex flex-col gap-y-2"
                  dark
                />
              </div>
            ))}
          </div>
        )}
        {loggedInMode && action.status === "member_action" && (
          <div className="flex flex-col gap-y-4 md:hidden">
            <ActionCompletedBarWithInfo
              friendActivities={[]}
              action={action}
              textSize="base"
              textColor="zinc-500"
            />
            <Link
              to={href("/feed/:actionId", { actionId: action.id.toString() })}
              className="self-start flex flex-row items-center gap-x-1 border border-zinc-200 hover:bg-zinc-50 px-2 py-1 rounded"
            >
              <p className="font-medium text-sm">See activity</p>
              <img src={chevronLeft} className="w-3 h-3 rotate-270" />
            </Link>
          </div>
        )}
        {action.status !== "planned" && (
          <div className="flex flex-col">
            {loggedInMode && activeFollowUpForms.length > 0 && (
              <div className="flex flex-col gap-y-4 mb-6">
                <p className="font-semibold text-xl">Follow-up</p>
                {activeFollowUpForms.map((fuf) => (
                  <FollowUpFormPanel
                    key={fuf.id}
                    followUpForm={fuf}
                    actionId={action.id}
                    border={true}
                  />
                ))}
              </div>
            )}
            {loggedInMode && (
              <div className="flex flex-col lg:flex-row justify-between lg:items-center mb-4 gap-x-4">
                <p className="font-semibold text-xl flex-1">Task</p>
                <TaskTimeInfo
                  action={action}
                  nextEvent={nextEvent}
                  absoluteDeadline={true}
                />
              </div>
            )}
            <Outlet context={context} />
          </div>
        )}
        {loggedInMode && (
          <>
            <div id="description">
              <p className="font-semibold text-xl mb-4">Description</p>
              <AppMarkdownWrapper markdownContent={action?.body} />
            </div>

            {isAuthenticated && (
              <div>
                <p className="font-semibold text-xl mb-4">Discussion</p>
                <p className="mb-8">
                  Questions and comments about this action that other members
                  would find helpful.
                </p>
                <Comments objectId={action.id} type={"action"} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ActionContents;
