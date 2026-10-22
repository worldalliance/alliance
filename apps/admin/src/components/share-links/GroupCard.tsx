import { withCount } from "@alliance/common/plural";
import { SHARE_URL_LABEL_MAX_LENGTH } from "@alliance/common/shareUrlLabel";
import type { ShareUrlAdminDto } from "@alliance/shared/client/types.gen";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { ChevronDown, ChevronRight, Copy, Pencil, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { type Target, targetName, targetSubtitle } from "./shareLinkTargets";

const GroupCard: React.FC<{
  target: Target;
  rows: ShareUrlAdminDto[];
  duplicateCount: number;
  expanded: boolean;
  onToggle: () => void;
  onCopy: (url: string) => void;
  onUpdateLabel: (id: string, label: string) => Promise<boolean>;
  onDelete: (id: string, event: React.MouseEvent<HTMLElement>) => void;
}> = ({
  target,
  rows,
  duplicateCount,
  expanded,
  onToggle,
  onCopy,
  onUpdateLabel,
  onDelete,
}) => {
  return (
    <Card className="w-full !p-0" style={CardStyle.White}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex flex-row items-center gap-2 px-4 py-3 hover:bg-zinc-50 text-left"
      >
        {expanded ? (
          <ChevronDown size={16} className="text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-zinc-500 shrink-0" />
        )}
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <h3 className="font-semibold truncate">{targetName(target)}</h3>
          <p className="text-xs text-zinc-500">{targetSubtitle(target)}</p>
        </div>
        <div className="flex flex-row gap-2 shrink-0 text-xs text-zinc-600">
          <span>{withCount(rows.length, "link")}</span>
          {duplicateCount > 0 && (
            <span className="text-blue-700 font-semibold">
              {withCount(duplicateCount, "duplicate")}
            </span>
          )}
        </div>
      </button>
      {expanded && (
        <div className="flex flex-col px-4 pb-3">
          {rows.map((row) => (
            <ShareUrlRow
              key={row.id}
              row={row}
              onCopy={onCopy}
              onUpdateLabel={onUpdateLabel}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

const ShareUrlRow: React.FC<{
  row: ShareUrlAdminDto;
  onCopy: (url: string) => void;
  onUpdateLabel: (id: string, label: string) => Promise<boolean>;
  onDelete: (id: string, event: React.MouseEvent<HTMLElement>) => void;
}> = ({ row, onCopy, onUpdateLabel, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.label ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(row.label ?? "");
  }, [row.label, editing]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await onUpdateLabel(row.id, draft);
    setSaving(false);
    if (ok) setEditing(false);
  }, [onUpdateLabel, row.id, draft]);

  const handleCancel = useCallback(() => {
    setDraft(row.label ?? "");
    setEditing(false);
  }, [row.label]);

  return (
    <div className="flex flex-row items-start gap-3 py-2 border-t border-zinc-100 first:border-t-0">
      <div className="shrink-0 pt-0.5">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
            row.duplicate
              ? "text-blue-700 bg-blue-100"
              : "text-zinc-700 bg-zinc-100",
          )}
        >
          {row.duplicate ? "duplicate" : "canonical"}
        </span>
      </div>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-row items-center gap-2">
            <input
              type="text"
              className="flex-1 border border-zinc-300 rounded px-2 py-1 text-sm"
              placeholder="Label"
              maxLength={SHARE_URL_LABEL_MAX_LENGTH}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={saving}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSave();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  handleCancel();
                }
              }}
            />
            <Button
              type="button"
              color={ButtonColor.Blue}
              onClick={handleSave}
              disabled={saving}
              className="shrink-0"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              color={ButtonColor.Light}
              onClick={handleCancel}
              disabled={saving}
              className="shrink-0"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group flex flex-row items-center gap-1.5 text-left self-start max-w-full"
            aria-label="Edit label"
          >
            <span
              className={cn(
                "text-sm truncate",
                row.label
                  ? "font-medium text-zinc-900 group-hover:text-zinc-700"
                  : "italic text-zinc-400 group-hover:text-zinc-600",
              )}
            >
              {row.label || "No label"}
            </span>
            <Pencil
              size={12}
              className="shrink-0 text-zinc-400 group-hover:text-zinc-700"
            />
          </button>
        )}
        <p className="text-xs text-zinc-600 font-mono break-all">{row.url}</p>
        {row.sid && (
          <p className="text-[11px] text-zinc-400 font-mono">{row.sid}</p>
        )}
        {row.kind === "invite" && (
          <p className="text-xs font-medium text-green">
            {withCount(row.signupCount, "use")}
          </p>
        )}
      </div>
      <Button
        type="button"
        color={ButtonColor.Light}
        onClick={() => onCopy(row.url)}
        className="shrink-0"
      >
        <Copy size={14} />
        Copy
      </Button>
      <Button
        type="button"
        color={ButtonColor.Red}
        onClick={(event) => onDelete(row.id, event)}
        className="shrink-0"
      >
        <Trash2 size={14} />
        Delete
      </Button>
    </div>
  );
};

export default GroupCard;
