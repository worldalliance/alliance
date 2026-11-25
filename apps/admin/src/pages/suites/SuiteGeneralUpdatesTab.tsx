import type { ActionSuiteDto } from "@alliance/shared/client";
import { Link } from "react-router";
import { formatDateTime } from "../../lib/formatDate";
import { generalUpdateHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import Badge from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel } from "../../ui/templates/Overview";
import {
  STATUS_LABEL,
  STATUS_TONE,
  statusOf,
} from "../general-updates/generalUpdateRules";

const DATES_NOTE =
  "An update made for this suite takes its start and end from the suite's members start and deadline, once the suite has them. From its start, every signed-in member can open it under General updates.";

const pacific = (date: string | null) =>
  date ? formatDateTime(date, { timeZone: LAUNCH_TIME_ZONE }) : "—";

/** The general updates made for the suite. */
export function SuiteGeneralUpdatesTab({ suite }: { suite: ActionSuiteDto }) {
  const now = new Date();
  const updates = suite.generalUpdates;
  return (
    <Panel
      title="General updates"
      flush={updates.length > 0}
      action={
        <Button
          size="small"
          variant={ButtonVariant.Default}
          to={`${generalUpdateHref("new")}?suiteId=${suite.id}`}
        >
          Create general update
        </Button>
      }
    >
      {updates.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {updates.map((update) => {
                const status = statusOf(update, now);
                return (
                  <TableRow key={update.id}>
                    <TableCell truncate title={update.name}>
                      <Link
                        to={generalUpdateHref(update.id)}
                        className={nameLinkClass}
                      >
                        {update.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONE[status]}>
                        {STATUS_LABEL[status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{pacific(update.startDate)}</TableCell>
                    <TableCell>{pacific(update.endDate)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="border-t border-line px-card py-3 text-caption text-fg-muted">
            {DATES_NOTE}
          </p>
        </>
      ) : (
        <EmptyState
          title="No general updates for this suite yet"
          description={DATES_NOTE}
        />
      )}
    </Panel>
  );
}
