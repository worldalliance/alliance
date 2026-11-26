import {
  MANUAL_IMPORT_FIELD_BY_KIND,
  type DisplayBlock,
} from "@alliance/common/forms/display-blocks";
import { useMemo, useState } from "react";
import Badge, { BadgeTone } from "../../../../ui/Badge";
import Button, { ButtonVariant } from "../../../../ui/Button";
import InlineError from "../../../../ui/InlineError";
import { CheckboxField } from "../../../../ui/templates/Form";
import type { ManualTargets } from "./useManualTargets";

const CHIPS_SHOWN = 6;

export function PerUserOptions<T extends DisplayBlock>({
  block,
  onUpdate,
  onImport,
  targets: {
    manualUserContent,
    manualContentKeys,
    manualPerUserEnabled,
    manualUsers,
    isLoadingUsers,
    userLoadError,
    refetchUsers,
    selectManualTarget,
    activeManualUserId,
    hasContentForActiveUser,
  },
}: {
  block: T;
  onUpdate: (updates: Partial<T>) => void;
  /** Resolves to why nothing was imported, or null. */
  onImport: () => Promise<string | null>;
  targets: ManualTargets;
}) {
  const manualImportField = MANUAL_IMPORT_FIELD_BY_KIND[block.kind];
  const [importError, setImportError] = useState<string | null>(null);

  const [usersWithContent, usersWithoutContent] = useMemo(() => {
    const has = (id: number) =>
      Object.prototype.hasOwnProperty.call(manualUserContent, String(id));
    return [
      manualUsers.filter((user) => has(user.id)),
      manualUsers.filter((user) => !manualUserContent[String(user.id)]),
    ];
  }, [manualUserContent, manualUsers]);

  const clearContentForActiveUser = () => {
    if (!activeManualUserId || !manualUserContent[activeManualUserId]) return;
    const { [activeManualUserId]: _removed, ...rest } = manualUserContent;
    onUpdate({ manualUserContent: rest } as Partial<T>);
  };

  return (
    <div className="flex flex-col gap-3">
      <CheckboxField
        label="Manual content per user"
        checked={manualPerUserEnabled}
        onChange={(event) =>
          onUpdate({ manualPerUser: event.target.checked } as Partial<T>)
        }
      />
      {manualImportField && (
        <div className="flex flex-col gap-1.5">
          <Button
            variant={ButtonVariant.Default}
            size="small"
            className="self-start"
            title={`Read a {userId: string} JSON object from the clipboard and apply each string to ${manualImportField} per user.`}
            onClick={() => {
              setImportError(null);
              void onImport().then(setImportError);
            }}
          >
            Import from clipboard…
          </Button>
          <InlineError message={importError} />
        </div>
      )}
      {manualPerUserEnabled && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={ButtonVariant.Default}
              size="small"
              onClick={() => selectManualTarget(null)}
            >
              Edit default
            </Button>
            {activeManualUserId && (
              <Badge
                tone={
                  hasContentForActiveUser
                    ? BadgeTone.Success
                    : BadgeTone.Warning
                }
              >
                {hasContentForActiveUser ? "Custom content" : "Using default"}
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-3 rounded-md bg-surface-2 p-3">
            {userLoadError ? (
              <InlineError message={userLoadError}>
                <Button
                  variant={ButtonVariant.Ghost}
                  size="small"
                  onClick={refetchUsers}
                >
                  Retry
                </Button>
              </InlineError>
            ) : isLoadingUsers ? (
              <span className="text-fg-muted">Loading users…</span>
            ) : manualUsers.length === 0 ? (
              <>
                <UserChips
                  heading={`Users with content (${manualContentKeys.length})`}
                  empty="No overrides yet"
                  tone={BadgeTone.Success}
                  entries={manualContentKeys.map((id) => ({
                    id,
                    label: `User ${id}`,
                  }))}
                  onPick={null}
                />
                <p className="text-caption text-fg-muted">
                  Load users to see who is missing content.
                </p>
              </>
            ) : (
              <>
                <UserChips
                  heading={`Users with content (${usersWithContent.length})`}
                  empty="None yet"
                  tone={BadgeTone.Success}
                  entries={usersWithContent.map(chipOf)}
                  onPick={selectManualTarget}
                />
                <UserChips
                  heading={`Missing (${usersWithoutContent.length})`}
                  empty="Everyone set"
                  tone={BadgeTone.Neutral}
                  entries={usersWithoutContent.map(chipOf)}
                  onPick={selectManualTarget}
                />
              </>
            )}
          </div>
          {activeManualUserId && hasContentForActiveUser && (
            <Button
              variant={ButtonVariant.DangerOutline}
              size="small"
              className="self-start"
              onClick={clearContentForActiveUser}
            >
              Clear content for this user
            </Button>
          )}
        </>
      )}
    </div>
  );
}

type Chip = { id: string; label: string };

const chipOf = (user: { id: number; name?: string | null }): Chip => ({
  id: String(user.id),
  label: user.name ?? `User #${user.id}`,
});

function UserChips({
  heading,
  empty,
  tone,
  entries,
  onPick,
}: {
  heading: string;
  empty: string;
  tone: BadgeTone;
  entries: Chip[];
  /** Null leaves the chips as plain labels, for users not loaded yet. */
  onPick: ((userId: string) => void) | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-medium">{heading}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {entries.length === 0 && <span className="text-fg-muted">{empty}</span>}
        {entries.slice(0, CHIPS_SHOWN).map((entry) =>
          onPick ? (
            <button
              key={entry.id}
              type="button"
              onClick={() => onPick(entry.id)}
              className="rounded-full focus-ring"
            >
              <Badge tone={tone}>{entry.label}</Badge>
            </button>
          ) : (
            <Badge key={entry.id} tone={tone}>
              {entry.label}
            </Badge>
          ),
        )}
        {entries.length > CHIPS_SHOWN && (
          <span className="text-caption text-fg-muted">
            +{entries.length - CHIPS_SHOWN} more
          </span>
        )}
      </div>
    </div>
  );
}
