import { errorMessage } from "@alliance/common/errorMessage";
import { tasksGetForm } from "@alliance/shared/client";
import type {
  ActionReviewerIcon,
  ProfileDto,
} from "@alliance/shared/client/types.gen";
import { shuffleWithSeed } from "@alliance/shared/forms/randomutils";
import { useCompletedTaskForm } from "@alliance/shared/lib/actionTaskPanelCompleted";
import { isFollowUpFormActive } from "@alliance/shared/lib/actionUtils";
import { clipboardCopy } from "@alliance/shared/lib/copy";
import { getNextEvent } from "@alliance/shared/lib/largeActionCard";
import { nameListSeparator } from "@alliance/shared/lib/nameList";
import {
  buildActionShareUrl,
  buildShareText,
  getCompletedShareableTextTemplate,
  getDefaultShareableTextTemplate,
} from "@alliance/shared/lib/shareText";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import AggregateProgressBarBlock from "@alliance/sharedweb/ui/AggregateProgressBarBlock";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import ExternalLinkPreview from "@alliance/sharedweb/ui/ExternalLinkPreview";
import LinkedInIcon from "@alliance/sharedweb/ui/icons/LinkedInIcon";
import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon } from "lucide-react";
import { Fragment, useEffect, useMemo, type ReactNode } from "react";
import {
  Link,
  Outlet,
  href,
  useLocation,
  useOutletContext,
} from "react-router";
import chevronLeft from "../assets/icons8-expand-arrow-96.png";
import { useAuth } from "../lib/AuthContext";
import { useLiveTaskFormAggregateViews } from "../lib/useLiveTaskFormAggregateViews";
import ActionCompletedBarWithInfo from "../pages/app/ActionCompletedBarWithInfo";
import TaskTimeInfo from "../pages/app/TaskTimeInfo";
import ActionEventsPanel from "./ActionEventsPanel";
import { TaskPanelContext } from "./ActionPageTaskPanel";
import Comments from "./Comments";
import FollowUpFormPanel from "./FollowUpFormPanel";
import ShareButton from "./ShareButton";

const ReviewerIcon = ({ icon }: { icon: ActionReviewerIcon }) => {
  switch (icon) {
    case "linkedin":
      return (
        <span className="inline-block align-[-2px] mr-1">
          <LinkedInIcon size="medium" />
        </span>
      );
    default:
      icon satisfies never;
      return null;
  }
};

/** Name list with separators, optionally prefixed (e.g. "Reviewed by"). */
const NameList = ({ label, items }: { label?: string; items: ReactNode[] }) => (
  <div className="flex flex-row flex-wrap gap-x-1 text-sm">
    {label && <p>{label}</p>}
    {items.map((item, i) => (
      <span key={i} className="text-nowrap">
        {item}
        {nameListSeparator(i, items.length)}
      </span>
    ))}
  </div>
);

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
          errorMessage({
            error: response.error,
            fallback: "Unable to load form",
          }),
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
              <p className="text-base md:text-lg">{action.shortDescription}</p>
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
                <p className="text-title-small">Follow-up</p>
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
                <p className="text-title-small flex-1">Task</p>
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
              <p className="text-title-small mb-4">Description</p>
              <AppMarkdownWrapper
                markdownContent={action?.body}
                distinguishActionLinks={true}
              />
            </div>

            {(!!shuffledAuthors.length || !!action.reviewers?.length) && (
              <div>
                <p className="text-title-small mb-4">Contributors</p>
                <div className="flex flex-col gap-y-2">
                  {!!shuffledAuthors.length && (
                    <div className="flex flex-row flex-wrap gap-x-3 gap-y-1.5">
                      {shuffledAuthors.map((author: ProfileDto) => (
                        <Link
                          key={author.id}
                          to={href("/member/:id", {
                            id: author.id.toString(),
                          })}
                          className="flex items-center gap-x-1.5 hover:underline"
                        >
                          <AvatarProfile
                            pfp={author.profilePicture}
                            size="override"
                            className="w-5 h-5 rounded"
                          />
                          <span className="text-sm">{author.displayName}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                  {!!action.reviewers?.length && (
                    <NameList
                      label="Reviewed by"
                      items={action.reviewers.map((reviewer, i) =>
                        reviewer.url ? (
                          <ExternalLinkPreview
                            key={i}
                            href={reviewer.url}
                            className="underline text-inherit"
                          >
                            {reviewer.icon && (
                              <ReviewerIcon icon={reviewer.icon} />
                            )}
                            {reviewer.name}
                          </ExternalLinkPreview>
                        ) : (
                          <Fragment key={i}>
                            {reviewer.icon && (
                              <ReviewerIcon icon={reviewer.icon} />
                            )}
                            {reviewer.name}
                          </Fragment>
                        ),
                      )}
                    />
                  )}
                </div>
              </div>
            )}

            {isAuthenticated && (
              <div>
                <p className="text-title-small mb-4">Discussion</p>
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
