import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
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
import { getLastAndNextEvent } from "@alliance/shared/lib/largeActionCard";
import { isFollowUpFormActive } from "@alliance/shared/lib/actionUtils";
import TaskTimeInfo from "../pages/app/TaskTimeInfo";
import ActionEventsPanel from "./ActionEventsPanel";
import FollowUpFormPanel from "./FollowUpFormPanel";
import { TaskPanelContext } from "./ActionPageTaskPanel";
import Comments from "./Comments";
import Card from "@alliance/sharedweb/ui/Card";
import { shuffleWithSeed } from "@alliance/shared/forms/randomutils";
import { useEffect, useMemo } from "react";
import ActionCompletedBarWithInfo from "../pages/app/ActionCompletedBarWithInfo";
import { CardStyle } from "@alliance/shared/styles/card";
import { externalOnly } from "@alliance/shared/lib/copy";

const ActionContents = () => {
  const context = useOutletContext<TaskPanelContext>();
  const location = useLocation();

  const action = context.action;

  const { isAuthenticated } = useAuth();
  const loggedInMode = !action.publicOnly;

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
  }, [action.followUpForms, context.userRelation]);

  if (!action) {
    return null;
  }

  const { lastEvent, nextEvent } = getLastAndNextEvent(action);

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
                lastEvent={lastEvent}
                absoluteDeadline={true}
              />
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-y-8 sm:gap-y-12">
        {loggedInMode && <ActionEventsPanel action={action} />}
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
        {isAuthenticated && action.publicOnly && (
          <Card style={CardStyle.Grey}>{externalOnly}</Card>
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
