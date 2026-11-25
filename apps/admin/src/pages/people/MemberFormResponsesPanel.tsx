import { formLabel, useFormDisplaySlugs } from "@alliance/shared/lib/useFormsAdmin";
import { useMemo } from "react";
import { href, Link } from "react-router";
import { formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { useUserNotifsAndFormsAdmin } from "../../lib/useUserNotifsAndFormsAdmin";
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
import { ContentState, TableSkeleton } from "../../ui/templates/States";

/** Every form response the member gave, newest first. */
export function MemberFormResponsesPanel({ userId }: { userId: number }) {
  const { formResponses: query } = useUserNotifsAndFormsAdmin(userId);
  const slugs = useFormDisplaySlugs();
  const responses = useMemo(
    () =>
      [...(query.data ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [query.data],
  );
  return (
    <Panel
      title="Form responses"
      description={query.data ? formatCount(responses.length) : undefined}
      flush
    >
      <ContentState
        things="form responses"
        query={query}
        skeleton={<TableSkeleton columns={3} rows={3} />}
        empty={responses.length === 0}
        emptyTitle="No form responses"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Form</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Device</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {responses.map((response) => (
              <TableRow key={response.id}>
                <TableCell truncate>
                  <Link
                    to={`${href("/tasks/forms/:formId", { formId: response.formId.toString() })}?tab=responses`}
                    className={nameLinkClass}
                  >
                    {formLabel(slugs, response.formId)}
                  </Link>
                </TableCell>
                <TableCell>{formatDateTime(response.createdAt)}</TableCell>
                <TableCell>{response.deviceType ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ContentState>
    </Panel>
  );
}
