import type { AdminActionListItemDto } from "@alliance/shared/client";
import { compareFollowUpFormsByStartDateDesc } from "@alliance/shared/lib/homePage";
import { useId, useMemo } from "react";
import { Link } from "react-router";
import { followUpFormLabel } from "../../../lib/followUpFormLabel";
import { formatDateTime } from "../../../lib/formatDate";
import { followUpHomePlacement } from "../../../lib/homePlacement";
import { taskHref } from "../../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { linkClass } from "../../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import { PlacementBadges } from "./PlacementBadges";

const when = (date: string | null) =>
  date ? formatDateTime(date, { timeZone: LAUNCH_TIME_ZONE }) : "—";

/** Follow-up forms in the order home pages show them, which staff can't change. */
export function PriorityFollowUps({
  actions,
  showAll,
}: {
  actions: AdminActionListItemDto[];
  showAll: boolean;
}) {
  const headingId = useId();
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
    <section aria-labelledby={headingId} className="border-t border-line pt-6">
      <div className="flex flex-col gap-1 px-page pb-3">
        <h2 id={headingId} className="text-heading font-semibold">
          Follow-up forms
        </h2>
        <p className="text-fg-muted">
          Shown to members who completed their task, after their tasks, newest
          start first. Their order can't be changed here.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-page pb-6 text-fg-muted">No follow-up forms.</p>
      ) : (
        <Table bleed>
          <TableHeader>
            <TableRow>
              <TableHead>Form</TableHead>
              <TableHead>Home pages</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead>Ends</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ followUpForm, parent, placement }) => (
              <TableRow key={followUpForm.id}>
                <TableCell truncate className="font-medium">
                  {followUpFormLabel(followUpForm)}
                </TableCell>
                <TableCell>
                  <PlacementBadges placement={placement} />
                </TableCell>
                <TableCell truncate title={parent.name}>
                  <Link to={taskHref(parent.id)} className={linkClass}>
                    {parent.name}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {when(followUpForm.startDate)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {when(followUpForm.endDate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
