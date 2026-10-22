import {
  MANUAL_IMPORT_FIELD_BY_KIND,
  type DisplayBlock,
} from "@alliance/common/forms/display-blocks";
import { cn } from "@alliance/shared/styles/util";
import { useMemo } from "react";
import type { ManualTargets } from "./useManualTargets";

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
    activeUser,
    handleCycleUser,
  },
}: {
  block: T;
  onUpdate: (updates: Partial<T>) => void;
  onImport: () => Promise<void>;
  targets: ManualTargets;
}) {
  const manualImportField = MANUAL_IMPORT_FIELD_BY_KIND[block.kind];

  const usersWithContent = useMemo(
    () =>
      manualUsers.filter((candidate) =>
        Object.prototype.hasOwnProperty.call(
          manualUserContent,
          String(candidate.id),
        ),
      ),
    [manualUserContent, manualUsers],
  );
  const usersWithoutContent = useMemo(
    () =>
      manualUsers.filter(
        (candidate) => !manualUserContent[String(candidate.id)],
      ),
    [manualUserContent, manualUsers],
  );

  const handleManualToggle = (checked: boolean) => {
    onUpdate({ manualPerUser: checked } as Partial<T>);
  };

  const clearContentForActiveUser = () => {
    if (!activeManualUserId) {
      return;
    }
    if (!manualUserContent[activeManualUserId]) {
      return;
    }
    const { [activeManualUserId]: _removed, ...rest } = manualUserContent;
    onUpdate({
      manualUserContent: rest,
    } as Partial<T>);
  };

  return (
    <div>
      <label className="flex cursor-pointer items-center px-3 py-1.5 text-gray-700">
        <input
          type="checkbox"
          className="mr-2"
          checked={manualPerUserEnabled}
          onChange={(event) => handleManualToggle(event.target.checked)}
        />
        Manual content per user
      </label>
      {manualImportField && (
        <div className="px-3 py-1.5">
          <button
            type="button"
            className="block w-full rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-100"
            onClick={() => void onImport()}
            title={`Read a {userId: string} JSON object from the clipboard and apply each string to ${manualImportField} per user.`}
          >
            Import from clipboard…
          </button>
        </div>
      )}
      {manualPerUserEnabled && (
        <div className="px-3 pb-1 pt-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="text-xs text-gray-600 border border-gray-200 rounded px-2 py-1 hover:border-gray-300"
              onClick={() => selectManualTarget(null)}
            >
              Edit default
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="text-xs text-gray-600 border border-gray-200 rounded px-2 py-1 hover:border-gray-300 disabled:opacity-50"
                onClick={() => handleCycleUser("prev")}
                disabled={manualUsers.length === 0}
              >
                Prev
              </button>
              <button
                type="button"
                className="text-xs text-gray-600 border border-gray-200 rounded px-2 py-1 hover:border-gray-300 disabled:opacity-50"
                onClick={() => handleCycleUser("next")}
                disabled={manualUsers.length === 0}
              >
                Next
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-700">
            {activeManualUserId ? (
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {activeUser
                    ? `${activeUser.name ?? "User"} (#${activeUser.id})`
                    : `User ${activeManualUserId}`}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px]",
                    hasContentForActiveUser
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800",
                  )}
                >
                  {hasContentForActiveUser ? "Custom content" : "Using default"}
                </span>
              </div>
            ) : (
              <span className="font-medium text-gray-700">
                Editing default content
              </span>
            )}
          </div>
          <div className="rounded-md border border-gray-100 bg-gray-50 p-2 text-xs text-gray-700 space-y-1">
            {userLoadError ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-red-700">{userLoadError}</span>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-700"
                  onClick={refetchUsers}
                >
                  Retry
                </button>
              </div>
            ) : isLoadingUsers ? (
              <span>Loading users…</span>
            ) : manualUsers.length === 0 ? (
              <>
                <div className="font-medium text-gray-800">
                  Users with content ({manualContentKeys.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {manualContentKeys.length === 0 ? (
                    <span className="text-gray-500">No overrides yet</span>
                  ) : (
                    manualContentKeys.slice(0, 6).map((userId) => (
                      <span
                        key={userId}
                        className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-800"
                      >
                        User {userId}
                      </span>
                    ))
                  )}
                  {manualContentKeys.length > 6 && (
                    <span className="text-[11px] text-gray-500">
                      +{manualContentKeys.length - 6} more
                    </span>
                  )}
                </div>
                <span className="text-gray-500">
                  Load users to see who is missing content.
                </span>
              </>
            ) : (
              <>
                <div className="font-medium text-gray-800">
                  Users with content ({usersWithContent.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {usersWithContent.length === 0 ? (
                    <span className="text-gray-500">None yet</span>
                  ) : (
                    usersWithContent.slice(0, 6).map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-800 hover:bg-green-200"
                        onClick={() => selectManualTarget(String(user.id))}
                      >
                        {user.name ?? `User #${user.id}`}
                      </button>
                    ))
                  )}
                  {usersWithContent.length > 6 && (
                    <span className="text-[11px] text-gray-500">
                      +{usersWithContent.length - 6} more
                    </span>
                  )}
                </div>
                <div className="font-medium text-gray-800 pt-1">
                  Missing ({usersWithoutContent.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {usersWithoutContent.length === 0 ? (
                    <span className="text-gray-500">Everyone set</span>
                  ) : (
                    usersWithoutContent.slice(0, 6).map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] text-gray-800 hover:bg-gray-300"
                        onClick={() => selectManualTarget(String(user.id))}
                      >
                        {user.name ?? `User #${user.id}`}
                      </button>
                    ))
                  )}
                  {usersWithoutContent.length > 6 && (
                    <span className="text-[11px] text-gray-500">
                      +{usersWithoutContent.length - 6} more
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          {activeManualUserId && hasContentForActiveUser && (
            <button
              type="button"
              className="text-xs text-red-700 hover:text-red-800"
              onClick={clearContentForActiveUser}
            >
              Clear content for this user
            </button>
          )}
        </div>
      )}
    </div>
  );
}
