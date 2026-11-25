import type { ShareUrlAdminDto } from "@alliance/shared/client/types.gen";
import { countOf, formatCount } from "../../lib/formatNumber";
import Button from "../../ui/Button";
import { MoreMenu } from "../../ui/MoreMenu";
import {
  Table,
  TableBody,
  TableCell,
  TableGroupRow,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import {
  type ShareLinkGroup,
  targetName,
  targetSubtitle,
} from "./shareLinkTargets";

const COLUMNS = 6;
export const SIGNUPS_COLUMN = "text-right tabular-nums";

export const shareLinkName = (link: ShareUrlAdminDto) =>
  link.label || link.sid || link.url;

export function ShareLinksTable({
  groups,
  rowProps,
  deletingId,
  onCopy,
  onEditLabel,
  onDelete,
}: {
  groups: readonly ShareLinkGroup[];
  rowProps: (id: string) => Record<string, string>;
  deletingId: string | null;
  onCopy: (url: string) => void;
  onEditLabel: (link: ShareUrlAdminDto) => void;
  onDelete: (link: ShareUrlAdminDto) => void;
}) {
  return (
    <Table bleed>
      <TableHeader>
        <TableRow>
          <TableHead>Label</TableHead>
          <TableHead>Link</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead className="text-right">Signups</TableHead>
          <TableHead actions>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <GroupRows
            key={group.key}
            group={group}
            rowProps={rowProps}
            deletingId={deletingId}
            onCopy={onCopy}
            onEditLabel={onEditLabel}
            onDelete={onDelete}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function GroupRows({
  group,
  rowProps,
  deletingId,
  onCopy,
  onEditLabel,
  onDelete,
}: {
  group: ShareLinkGroup;
  rowProps: (id: string) => Record<string, string>;
  deletingId: string | null;
  onCopy: (url: string) => void;
  onEditLabel: (link: ShareUrlAdminDto) => void;
  onDelete: (link: ShareUrlAdminDto) => void;
}) {
  const facts = [
    targetSubtitle(group.target),
    group.duplicateCount > 0 &&
      group.duplicateCount < group.rows.length &&
      countOf(group.duplicateCount, "duplicate"),
  ].filter(Boolean);
  return (
    <>
      <TableGroupRow
        colSpan={COLUMNS}
        label={
          <>
            <span className="truncate">{targetName(group.target)}</span>
            <span className="text-caption font-medium text-fg-muted">
              {facts.join(" · ")}
            </span>
          </>
        }
        count={group.rows.length}
      />
      {group.rows.map((link) => {
        const name = shareLinkName(link);
        return (
          <TableRow key={link.id} {...rowProps(link.id)}>
            <TableCell truncate className="font-medium">
              {link.label || <span className="text-fg-muted">No label</span>}
            </TableCell>
            <TableCell truncate className="font-mono text-xs">
              {link.url}
            </TableCell>
            <TableCell className="font-mono text-xs text-fg-muted">
              {link.sid ?? "—"}
            </TableCell>
            <TableCell>{link.duplicate ? "Duplicate" : "Original"}</TableCell>
            <TableCell className={SIGNUPS_COLUMN}>
              {link.campaignId === null ? formatCount(link.signupCount) : "—"}
            </TableCell>
            <TableCell actions>
              <Button
                size="small"
                aria-label={`Copy link: ${name}`}
                onClick={() => onCopy(link.url)}
              >
                Copy link
              </Button>
              <MoreMenu
                size="small"
                subject={name}
                busy={deletingId === link.id}
                items={[
                  { label: "Edit label…", onSelect: () => onEditLabel(link) },
                  {
                    label: "Delete",
                    destructive: true,
                    onSelect: () => onDelete(link),
                  },
                ]}
              />
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
