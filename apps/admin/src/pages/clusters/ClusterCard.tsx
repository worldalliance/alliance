import type { ClusterAdminDto } from "@alliance/shared/client/types.gen";
import { Pencil } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { memberHref } from "../../lib/hrefs";
import { useRenameClusterAdmin } from "../../lib/useClustersAdmin";
import { AvatarProfile } from "../../ui/Avatar";
import Button, { ButtonVariant } from "../../ui/Button";
import Card from "../../ui/Card";
import InlineError from "../../ui/InlineError";
import { Input } from "../../ui/Input";

const RENAME_FAILED = "Couldn't rename the cluster.";
const HEADER_ROW = "flex min-h-control items-center gap-3";
// Wide enough for Save and Cancel, so the count holds still when the editor opens.
const ACTIONS = "flex w-40 shrink-0 justify-end gap-2";

export function ClusterCard({
  cluster,
  onSave,
}: {
  cluster: ClusterAdminDto;
  onSave: (id: number) => void;
}) {
  const helpId = useId();
  const renameRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cluster.displayName);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setEditing(false);
    setError(null);
    // The editor held focus; it returns to the control that opened it.
    requestAnimationFrame(() => renameRef.current?.focus());
  };
  const rename = useRenameClusterAdmin({
    onSuccess: close,
    onError: (err) => setError(adminRefusalMessage(err, RENAME_FAILED)),
  });

  const open = () => {
    setDraft(cluster.displayName);
    setEditing(true);
    // On the next frame: focused now, the input would take the Enter that
    // pressed Rename and submit the unchanged name.
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const save = () => {
    const name = draft.trim();
    if (!name || name === cluster.displayName) {
      close();
      return;
    }
    setError(null);
    onSave(cluster.id);
    rename.mutate({ id: cluster.id, displayName: name });
  };

  const memberCount = (
    <span className="ml-auto shrink-0 text-fg-muted tabular-nums">
      {countOf(cluster.members.length, "member")}
    </span>
  );

  return (
    <Card className="gap-4">
      <div className="flex flex-col gap-1">
        {editing ? (
          <form
            key="editing"
            noValidate
            className={HEADER_ROW}
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <Input
              ref={inputRef}
              aria-label={`Name of cluster ${cluster.displayName}`}
              aria-describedby={helpId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !rename.isPending) {
                  event.preventDefault();
                  close();
                }
              }}
              className="h-control-sm max-w-sm flex-1 font-semibold"
            />
            {memberCount}
            <div className={ACTIONS}>
              <Button
                type="submit"
                size="small"
                variant={ButtonVariant.Primary}
                busy={rename.isPending}
              >
                Save
              </Button>
              <Button
                size="small"
                variant={ButtonVariant.Ghost}
                disabled={rename.isPending}
                onClick={close}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div key="viewing" className={HEADER_ROW}>
            <h2 className="min-w-0 flex-1 truncate text-heading font-semibold">
              {cluster.displayName}
            </h2>
            {memberCount}
            <div className={ACTIONS}>
              <Button
                ref={renameRef}
                size="small"
                variant={ButtonVariant.Ghost}
                aria-label={`Rename cluster: ${cluster.displayName}`}
                onClick={open}
              >
                <Pencil aria-hidden="true" className="size-3.5" />
                Rename
              </Button>
            </div>
          </div>
        )}
        {editing && (
          <>
            <p id={helpId} className="text-caption text-fg-muted">
              Members see this name beside replies on forum posts that show
              cluster tags.
            </p>
            <InlineError message={error} />
          </>
        )}
      </div>
      {cluster.members.length === 0 ? (
        <p className="text-fg-muted">No members</p>
      ) : (
        <ul
          aria-label={`Members of ${cluster.displayName}`}
          className="flex flex-wrap gap-2"
        >
          {cluster.members.map((member) => (
            <li key={member.id} className="min-w-0">
              <Link
                to={memberHref(member.id)}
                className="flex h-8 max-w-64 items-center gap-2 rounded-full border border-line bg-surface-2 pr-3 pl-1 focus-ring transition-colors duration-fast hover:border-line-strong"
              >
                <AvatarProfile
                  pfp={member.profilePicture ?? null}
                  size="small"
                />
                <span className="truncate">{member.displayName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
