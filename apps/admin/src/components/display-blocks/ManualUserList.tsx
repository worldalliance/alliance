import type { UserDto } from "@alliance/shared/client";
import { CircleCheck, CircleDashed } from "lucide-react";
import { useMemo, useState } from "react";
import Badge, { BadgeTone } from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Input } from "../../ui/Input";
import Sheet from "../../ui/Sheet";
import type { ManualTargets } from "./useManualTargets";

type ManualUserListEntry = Pick<UserDto, "id" | "name" | "hasActiveContract">;

/**
 * "n set / total" opens a sheet over everyone who could have content of their
 * own, to find one by name or id and edit theirs.
 */
export function ManualUserList({ targets }: { targets: ManualTargets }) {
  const { manualContentKeys, manualUsers, isLoadingUsers, refetchUsers } =
    targets;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex items-center justify-end gap-2">
      {isLoadingUsers && (
        <span className="text-caption text-fg-muted">Loading users…</span>
      )}
      {!isLoadingUsers && manualUsers.length === 0 && (
        <Button
          variant={ButtonVariant.Ghost}
          size="small"
          onClick={refetchUsers}
        >
          Load users
        </Button>
      )}
      <Button
        variant={ButtonVariant.Default}
        size="small"
        onClick={() => {
          if (manualUsers.length === 0) refetchUsers();
          setIsOpen(true);
        }}
      >
        {manualContentKeys.length} set / {targets.totalManualTargets} total
      </Button>
      <Sheet
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Users"
        size="peek"
      >
        <UserListBody targets={targets} onPicked={() => setIsOpen(false)} />
      </Sheet>
    </div>
  );
}

function UserListBody({
  targets: {
    manualUserContent,
    manualUsers,
    isLoadingUsers,
    selectManualTarget,
    activeManualUserId,
  },
  onPicked,
}: {
  targets: ManualTargets;
  onPicked: () => void;
}) {
  const [userSearch, setUserSearch] = useState("");
  const shown = useMemo(() => {
    const entries: ManualUserListEntry[] = manualUsers
      .map(({ id, name, hasActiveContract }) => ({
        id,
        name,
        hasActiveContract,
      }))
      .sort((a, b) =>
        (a.name ?? String(a.id))
          .toLowerCase()
          .localeCompare((b.name ?? String(b.id)).toLowerCase()),
      );
    const query = userSearch.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter(
      (entry) =>
        (entry.name ?? "").toLowerCase().includes(query) ||
        String(entry.id).includes(query),
    );
  }, [manualUsers, userSearch]);

  return (
    <div className="flex flex-col gap-3 p-card">
      <Input
        type="search"
        aria-label="Search users"
        placeholder="Search users"
        value={userSearch}
        onChange={(event) => setUserSearch(event.target.value)}
      />
      {isLoadingUsers && <p className="text-caption text-fg-muted">Loading…</p>}
      <ul className="flex flex-col divide-y divide-line">
        {shown.map((entry) => {
          const userId = String(entry.id);
          const hasContent = Boolean(manualUserContent[userId]);
          const ContractIcon = entry.hasActiveContract
            ? CircleCheck
            : CircleDashed;
          return (
            <li key={userId} className="flex items-center gap-3 py-1">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left focus-ring hover:bg-surface-2"
                onClick={() => {
                  selectManualTarget(userId);
                  onPicked();
                }}
              >
                <span
                  className={cn(
                    "truncate",
                    activeManualUserId === userId && "font-semibold",
                  )}
                >
                  {entry.name ?? `User ${entry.id}`}
                </span>
                <Badge
                  tone={hasContent ? BadgeTone.Success : BadgeTone.Neutral}
                >
                  {hasContent ? "Set" : "Unset"}
                </Badge>
              </button>
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 text-caption",
                  entry.hasActiveContract ? "text-success" : "text-warning",
                )}
              >
                <ContractIcon aria-hidden="true" className="size-4" />
                {entry.hasActiveContract
                  ? "Active contract"
                  : "No active contract"}
              </span>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && !isLoadingUsers && (
        <p className="text-fg-muted">No users match your search.</p>
      )}
    </div>
  );
}
