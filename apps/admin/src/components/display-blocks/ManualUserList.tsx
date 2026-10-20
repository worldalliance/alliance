import type { UserDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { CheckCircle2, Circle } from "lucide-react";
import { useMemo, useState } from "react";
import type { ManualTargets } from "./useManualTargets";

type ManualUserListEntry = Pick<UserDto, "id" | "name" | "hasActiveContract">;

export function ManualUserList({
  targets: {
    manualUserContent,
    manualContentKeys,
    manualUsers,
    isLoadingUsers,
    refetchUsers,
    selectManualTarget,
    activeManualUserId,
    totalManualTargets,
  },
}: {
  targets: ManualTargets;
}) {
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const setCount = manualContentKeys.length;
  const sortedManualUsers: ManualUserListEntry[] = useMemo(() => {
    const base: ManualUserListEntry[] = manualUsers.map((user) => ({
      id: user.id,
      name: user.name,
      hasActiveContract: user.hasActiveContract,
    }));
    return base.sort((a, b) => {
      const aLabel = (a.name ?? String(a.id)).toLowerCase();
      const bLabel = (b.name ?? String(b.id)).toLowerCase();
      return aLabel.localeCompare(bLabel);
    });
  }, [manualUsers]);
  const filteredManualUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return sortedManualUsers;
    return sortedManualUsers.filter((entry) => {
      const name = (entry.name ?? "").toLowerCase();
      const idString = String(entry.id).toLowerCase();
      return name.includes(query) || idString.includes(query);
    });
  }, [sortedManualUsers, userSearch]);

  return (
    <>
      <div className="flex w-full items-center justify-end gap-2 text-sm">
        {isLoadingUsers && <span>Loading users…</span>}
        {!isLoadingUsers && manualUsers.length === 0 && (
          <button
            type="button"
            className="text-blue-600 hover:text-blue-700"
            onClick={refetchUsers}
          >
            Load users
          </button>
        )}
        <button
          type="button"
          className="text-gray-600 underline decoration-dotted underline-offset-2"
          onClick={() => {
            if (!isUserListOpen && manualUsers.length === 0) {
              refetchUsers();
            }
            setIsUserListOpen((prev) => !prev);
          }}
        >
          {setCount} set / {totalManualTargets} total
        </button>
      </div>
      {isUserListOpen && (
        <div className="mt-2 rounded-md border border-gray-200 bg-white">
          <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-700">
            <span className="font-medium">Users</span>
            {isLoadingUsers && <span className="text-gray-500">Loading…</span>}
          </div>
          <div className="px-3 pb-2">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users"
              className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
            {filteredManualUsers.map((entry) => {
              const userId = String(entry.id);
              const name = entry.name ?? `User ${entry.id}`;
              const hasContent = Boolean(manualUserContent[userId]);
              const StatusIcon = entry.hasActiveContract
                ? CheckCircle2
                : Circle;
              const statusColor = entry.hasActiveContract
                ? "text-emerald-600"
                : "text-amber-600";
              return (
                <button
                  key={userId}
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50"
                  onClick={() => selectManualTarget(userId)}
                >
                  <span className="flex items-center gap-2 truncate">
                    <StatusIcon
                      className={cn("h-3 w-3", statusColor)}
                      strokeWidth={3}
                    />
                    <span
                      className={cn(
                        "truncate",
                        activeManualUserId === userId
                          ? "font-semibold text-blue-700"
                          : "text-gray-800",
                      )}
                    >
                      {name}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "text-xs rounded-full px-2 py-0.5",
                      hasContent
                        ? "bg-green/10 text-green-800"
                        : "bg-gray-100 text-gray-700",
                    )}
                  >
                    {hasContent ? "Set" : "Unset"}
                  </span>
                </button>
              );
            })}
            {filteredManualUsers.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">
                No users match your search.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
