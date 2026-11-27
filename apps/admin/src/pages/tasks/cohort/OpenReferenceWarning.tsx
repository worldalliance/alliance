import {
  findUnawaitedOpenReferences,
  type CohortExpression,
  type ReferencedAction,
} from "@alliance/common/cohort-expression";
import { pickForCount } from "@alliance/common/plural";
import { checkPrerequisiteDeadline } from "@alliance/common/prerequisite";
import React from "react";
import { Banner, BannerTone } from "../../../ui/templates/Banner";

const OpenReferenceWarning: React.FC<{
  actionId: number | undefined;
  expression: CohortExpression | null | undefined;
  prerequisiteActionIds: number[];
  memberActionStart: Date | null;
  memberActionDeadline: Date | null;
  actions: (ReferencedAction & { name: string })[];
}> = ({
  actionId,
  expression,
  prerequisiteActionIds,
  memberActionStart,
  memberActionDeadline,
  actions,
}) => {
  const openIds = new Set(
    findUnawaitedOpenReferences({
      actionId,
      expression,
      prerequisiteActionIds,
      decidedAt: memberActionStart ?? new Date(),
      actions,
    }),
  );
  const open = actions.filter((action) => openIds.has(action.id));
  if (open.length === 0) return null;
  const onboarding = open.filter((action) => action.onboarding);
  const awaitable = open.filter(
    (action) =>
      !action.onboarding &&
      checkPrerequisiteDeadline({
        upstream: action.deadline,
        dependent: memberActionDeadline,
      }).ok,
  );
  const sharingDeadline = awaitable.filter(
    (action) =>
      action.deadline !== null &&
      action.deadline.getTime() === memberActionDeadline?.getTime(),
  );
  const unawaitable = open.filter(
    (action) => !action.onboarding && !awaitable.includes(action),
  );
  const names = (list: typeof open) =>
    list.map((action) => `"${action.name}"`).join(", ");
  return (
    <div className="mt-3">
      <Banner tone={BannerTone.Warning} inline>
        <div className="flex flex-col gap-1.5">
          {awaitable.length > 0 && (
            <p>
              These conditions read {names(awaitable)},{" "}
              {memberActionStart
                ? "still open when members are decided at launch. A member"
                : `still open now. If this task launches before ${pickForCount(awaitable.length, "it closes", "they close")}, a member`}{" "}
              who finishes {pickForCount(awaitable.length, "it", "one")} later
              keeps their first placement.{" "}
              {pickForCount(
                awaitable.length,
                "Add it as a prerequisite",
                "Add them as prerequisites",
              )}{" "}
              to wait for each member&apos;s outcome.
            </p>
          )}
          {sharingDeadline.length > 0 && (
            <p>
              {names(sharingDeadline)}{" "}
              {pickForCount(sharingDeadline.length, "closes", "close")} with
              this task, so a member who never finishes{" "}
              {pickForCount(sharingDeadline.length, "it", "one")} is decided
              only as this task closes, too late to take part.
            </p>
          )}
          {unawaitable.length > 0 && (
            <p>
              These conditions read {names(unawaitable)}, which{" "}
              {pickForCount(
                unawaitable.length,
                "closes after this task or has no deadline, so members are decided before it closes",
                "close after this task or have no deadline, so members are decided before they close",
              )}
              . A prerequisite needs a deadline no later than this task&apos;s.
            </p>
          )}
          {onboarding.length > 0 && (
            <p>
              These conditions read {names(onboarding)},{" "}
              {pickForCount(
                onboarding.length,
                "an onboarding task that stays open to members who join later. A prerequisite stops waiting at its deadline, so a member who joins after that is decided before finishing it",
                "onboarding tasks that stay open to members who join later. A prerequisite stops waiting at their deadline, so a member who joins after that is decided before finishing them",
              )}{" "}
              and keeps that placement.
            </p>
          )}
        </div>
      </Banner>
    </div>
  );
};

export default OpenReferenceWarning;
