import type { AdminActionListItemDto } from "@alliance/shared/client";
import { compareFollowUpFormsByStartDateDesc } from "@alliance/shared/lib/homePage";
import React, { useMemo } from "react";
import { Link } from "react-router";
import { followUpFormLabel } from "../lib/followUpFormLabel";
import { followUpHomePlacement } from "../lib/homePlacement";
import HomePlacementBadges from "./HomePlacementBadges";

const formatDate = (date: string | null) =>
  date ? new Date(date).toLocaleString() : "—";

const PriorityFollowUps: React.FC<{
  actions: AdminActionListItemDto[];
  showAll: boolean;
}> = ({ actions, showAll }) => {
  const rows = useMemo(() => {
    const now = new Date();
    return actions
      .flatMap((parent) =>
        parent.followUpForms.map((followUpForm) => ({
          followUpForm,
          parent,
          placement: followUpHomePlacement({ followUpForm, parent, now }),
        })),
      )
      .filter(({ placement }) => showAll || placement.inactive === null)
      .sort(
        (a, b) =>
          Number(a.placement.inactive !== null) -
            Number(b.placement.inactive !== null) ||
          compareFollowUpFormsByStartDateDesc(a.followUpForm, b.followUpForm),
      );
  }, [actions, showAll]);

  return (
    <section className="space-y-2">
      <h2 className="font-bold">Follow-up forms</h2>
      <p className="text-sm text-zinc-600">
        Shown after all tasks, newest start first, to members in the form&apos;s
        cohort who completed the parent action. Members can submit them
        repeatedly until they end. Their order can&apos;t be changed here.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No follow-up forms.</p>
      ) : (
        <ul className="border border-zinc-200 rounded-lg divide-y divide-zinc-200 bg-white">
          {rows.map(({ followUpForm, parent, placement }) => (
            <li
              key={followUpForm.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <span className="font-medium text-zinc-800">
                {followUpFormLabel(followUpForm)}
              </span>
              <HomePlacementBadges placement={placement} />
              <Link
                to={`/actions/${parent.id}`}
                className="text-sm text-zinc-600 hover:text-zinc-900 underline"
              >
                {parent.name}
              </Link>
              <span className="ml-auto text-xs text-zinc-500">
                {formatDate(followUpForm.startDate)} –{" "}
                {formatDate(followUpForm.endDate)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default PriorityFollowUps;
