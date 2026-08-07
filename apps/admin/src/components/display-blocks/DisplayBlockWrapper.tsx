import {
  MANUAL_IMPORT_FIELD_BY_KIND,
  manualImportClipboardSchema,
  type DisplayBlock,
  type ManualDisplayBlockContent,
} from "@alliance/common/forms/display-blocks";
import { type AnyField } from "@alliance/common/forms/form-schema";
import { type VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { userListAdmin, type UserDto } from "@alliance/shared/client";
import { resolveDisplayBlockForUser } from "@alliance/shared/formrenderer";
import { cn } from "@alliance/shared/styles/util";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { CheckCircle2, Circle } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ConditionalVisibility,
  type OutputBlockOption,
} from "../form-fields/CommonControls";
import { usePerViewerOptionsAllowed } from "./PerViewerOptionsContext";

type ManualUserListEntry = Pick<UserDto, "id" | "name" | "hasActiveContract">;

const stripManualFields = (
  updates: Partial<DisplayBlock>,
): Partial<DisplayBlock> => {
  const {
    manualPerUser: _manualPerUser,
    manualUserContent: _manualUserContent,
    ...rest
  } = updates as Partial<DisplayBlock>;
  return rest;
};

const stripIdentityFields = <T extends Record<string, unknown>>(
  value: T,
): Omit<T, "kind" | "id" | "type"> => {
  const { kind: _kind, id: _id, type: _type, ...rest } = value;
  return rest;
};

const baseManualContentFromBlock = (
  block: DisplayBlock,
): ManualDisplayBlockContent =>
  stripIdentityFields(
    stripManualFields({
      ...block,
      manualPerUser: undefined,
      manualUserContent: undefined,
    }) as Record<string, unknown>,
  ) as ManualDisplayBlockContent;

type DisplayBlockChildRenderProps<T extends DisplayBlock> = {
  block: T;
  onUpdate: (updates: Partial<T>) => void;
  activeUserId?: string | null;
  activeUserName?: string;
  isDefaultContent: boolean;
  hasContentForUser: boolean;
};

interface DisplayBlockWrapperProps<T extends DisplayBlock = DisplayBlock> {
  children: ReactNode | ((props: DisplayBlockChildRenderProps<T>) => ReactNode);
  onRemove: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  block?: T;
  onUpdate?: (updates: Partial<T>) => void;
  previousFields?: AnyField[];
  outputBlocks?: OutputBlockOption[];
}

export function DisplayBlockWrapper<T extends DisplayBlock = DisplayBlock>({
  children,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  block,
  onUpdate,
  previousFields,
  outputBlocks,
}: DisplayBlockWrapperProps<T>) {
  const manualImportField = block
    ? MANUAL_IMPORT_FIELD_BY_KIND[block.kind]
    : null;
  const { success, error: toastError, confirm } = useToast();
  const perViewerOptionsAllowed = usePerViewerOptionsAllowed();
  const showConditional = Boolean(block && onUpdate && perViewerOptionsAllowed);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement | null>(null);
  const hasAttemptedUserLoadRef = useRef(false);
  const [
    showConditionalVisibilityControl,
    setShowConditionalVisibilityControl,
  ] = useState<boolean>(() => {
    if (!block) return false;
    return block.visibleIfFormula?.conditions
      ? !!Object.keys(block.visibleIfFormula.conditions).length
      : false;
  });

  const manualUserContent = useMemo(
    () => block?.manualUserContent ?? {},
    [block?.manualUserContent],
  );
  const manualContentKeys = useMemo(
    () => Object.keys(manualUserContent),
    [manualUserContent],
  );
  const manualPerUserEnabled = Boolean(block?.manualPerUser);
  const [manualUsers, setManualUsers] = useState<UserDto[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const [activeManualUserId, setActiveManualUserId] = useState<string | null>(
    null,
  );
  const [hasUserSelectedTarget, setHasUserSelectedTarget] = useState(false);
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const manualTargetList = useMemo(
    () =>
      manualUsers.length > 0
        ? manualUsers.map((candidate) => String(candidate.id))
        : manualContentKeys,
    [manualContentKeys, manualUsers],
  );
  const totalManualTargets = manualTargetList.length;
  const activeManualIndex = useMemo(() => {
    if (!activeManualUserId) return -1;
    return manualTargetList.findIndex((id) => id === activeManualUserId);
  }, [activeManualUserId, manualTargetList]);
  const paginationLabel = useMemo(() => {
    if (totalManualTargets === 0) {
      return "0/0";
    }
    if (!activeManualUserId) {
      return `0/${totalManualTargets}`;
    }
    const displayIndex = activeManualIndex >= 0 ? activeManualIndex + 1 : 1;
    return `${displayIndex}/${totalManualTargets}`;
  }, [activeManualIndex, activeManualUserId, totalManualTargets]);
  const totalUserCount =
    manualUsers.length > 0 ? manualUsers.length : manualContentKeys.length;
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

  const selectManualTarget = useCallback(
    (userId: string | null, markSelection = true) => {
      if (markSelection) {
        setHasUserSelectedTarget(true);
      }
      setActiveManualUserId(userId);
    },
    [],
  );

  const loadUsers = useCallback(
    async (force = false) => {
      if (isLoadingUsers) return;
      if (!force && manualUsers.length > 0) return;
      setIsLoadingUsers(true);
      setUserLoadError(null);
      try {
        const response = await userListAdmin();
        setManualUsers(response.data ?? []);
      } catch (error) {
        console.error(
          "Failed to load users for display block overrides",
          error,
        );
        setUserLoadError("Unable to load users");
      } finally {
        hasAttemptedUserLoadRef.current = true;
        setIsLoadingUsers(false);
      }
    },
    [isLoadingUsers, manualUsers.length],
  );

  useEffect(() => {
    if (manualPerUserEnabled && !hasAttemptedUserLoadRef.current) {
      void loadUsers();
    }
  }, [loadUsers, manualPerUserEnabled]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current?.contains(event.target as Node)) return;
      setIsMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const useConditions = block?.visibleIfFormula?.conditions
      ? !!Object.keys(block.visibleIfFormula.conditions).length
      : false;

    if (useConditions && !showConditionalVisibilityControl) {
      setShowConditionalVisibilityControl(true);
    }
  }, [block, showConditionalVisibilityControl]);

  useEffect(() => {
    if (!manualPerUserEnabled) {
      selectManualTarget(null, false);
      setHasUserSelectedTarget(false);
      return;
    }
    if (hasUserSelectedTarget) {
      return;
    }
    const firstManualKey = manualContentKeys[0];
    if (firstManualKey) {
      selectManualTarget(firstManualKey, false);
      return;
    }
    if (manualUsers.length > 0) {
      selectManualTarget(String(manualUsers[0].id), false);
    }
  }, [
    activeManualUserId,
    hasUserSelectedTarget,
    manualPerUserEnabled,
    manualContentKeys,
    selectManualTarget,
    manualUsers,
  ]);

  const effectiveBlock = useMemo(() => {
    if (!block) return block;
    if (manualPerUserEnabled && activeManualUserId) {
      return resolveDisplayBlockForUser(block, activeManualUserId);
    }
    return block;
  }, [activeManualUserId, block, manualPerUserEnabled]);

  const hasContentForActiveUser = Boolean(
    activeManualUserId && manualUserContent[activeManualUserId],
  );
  const activeUser = useMemo(
    () =>
      manualPerUserEnabled && activeManualUserId
        ? manualUsers.find(
            (candidate) => String(candidate.id) === activeManualUserId,
          )
        : undefined,
    [activeManualUserId, manualPerUserEnabled, manualUsers],
  );
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

  const handleConditionalChange = (updates: {
    visibleIfFormula?: VisibleIfFormula;
  }) => {
    if (!onUpdate || !block) {
      return;
    }
    if (
      block.manualUserContent &&
      Object.keys(block.manualUserContent).length
    ) {
      const nextManualContent = Object.fromEntries(
        Object.entries(block.manualUserContent).map(([userId, content]) => [
          userId,
          { ...content, ...updates },
        ]),
      ) as Record<string, ManualDisplayBlockContent>;
      onUpdate({
        ...(updates as Partial<T>),
        manualUserContent: nextManualContent,
      } as Partial<T>);
      return;
    }

    onUpdate(updates as Partial<T>);
  };

  const handleConditionalVisibilityToggle = (checked: boolean) => {
    setShowConditionalVisibilityControl(checked);
    if (!checked) {
      handleConditionalChange({
        visibleIfFormula: undefined,
      });
    }
  };

  const handleManualToggle = (checked: boolean) => {
    if (!onUpdate) return;
    if (!checked) {
      selectManualTarget(null, false);
      setHasUserSelectedTarget(false);
      setIsUserListOpen(false);
    } else if (manualUsers.length === 0) {
      void loadUsers();
    }
    onUpdate({ manualPerUser: checked } as Partial<T>);
  };

  const handleCycleUser = (direction: "prev" | "next") => {
    if (totalManualTargets === 0) return;
    if (!activeManualUserId) {
      selectManualTarget(manualTargetList[0]);
      return;
    }

    const currentIndex = manualTargetList.findIndex(
      (id) => id === activeManualUserId,
    );
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      direction === "next"
        ? (safeIndex + 1) % totalManualTargets
        : (safeIndex - 1 + totalManualTargets) % totalManualTargets;
    selectManualTarget(manualTargetList[nextIndex]);
  };

  const handleBlockUpdate = useCallback(
    (updates: Partial<T>) => {
      if (!onUpdate || !block) {
        return;
      }
      if (manualPerUserEnabled && activeManualUserId) {
        const existingContent =
          manualUserContent[activeManualUserId] ??
          baseManualContentFromBlock(block);

        const nextManualContent: Record<string, ManualDisplayBlockContent> = {
          ...manualUserContent,
          [activeManualUserId]: stripIdentityFields({
            ...existingContent,
            ...(stripManualFields(updates) as Record<string, unknown>),
          }) as ManualDisplayBlockContent,
        };

        onUpdate({
          manualUserContent: nextManualContent,
        } as Partial<T>);
        return;
      }

      onUpdate(updates);
    },
    [
      activeManualUserId,
      block,
      manualPerUserEnabled,
      manualUserContent,
      onUpdate,
    ],
  );

  const handleImportFromClipboard = useCallback(async () => {
    if (!onUpdate || !block || !manualImportField) return;
    let clipboardText: string;
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch (err) {
      console.error("Could not read from clipboard", err);
      toastError("Could not read from clipboard.");
      return;
    }
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(clipboardText);
    } catch (err) {
      console.error("Could not parse clipboard JSON", err);
      toastError("Clipboard does not contain valid JSON.");
      return;
    }
    const parseResult = manualImportClipboardSchema.safeParse(rawJson);
    if (!parseResult.success) {
      toastError('Expected a JSON object like {"42": "text for user 42"}.');
      return;
    }
    const parsed = parseResult.data;

    const baseContent = baseManualContentFromBlock(block);

    const nextManualContent: Record<string, ManualDisplayBlockContent> = {
      ...manualUserContent,
    };

    const parsedEntries = Object.entries(parsed);
    let importedCount = 0;
    let overwriteCount = 0;
    for (const [userId, value] of parsedEntries) {
      const existingContent = nextManualContent[userId] ?? baseContent;
      const existingValue = (
        existingContent as Record<string, unknown> | undefined
      )?.[manualImportField];
      if (nextManualContent[userId] && existingValue === value) {
        continue;
      }
      if (
        nextManualContent[userId] &&
        typeof existingValue === "string" &&
        existingValue.length > 0 &&
        existingValue !== value
      ) {
        overwriteCount++;
      }
      nextManualContent[userId] = stripIdentityFields({
        ...existingContent,
        [manualImportField]: value,
      }) as ManualDisplayBlockContent;
      importedCount++;
    }

    if (parsedEntries.length === 0) {
      toastError("No string entries found in clipboard JSON.");
      return;
    }
    if (importedCount === 0) {
      toastError("Clipboard content already matches existing per-user values.");
      return;
    }

    if (overwriteCount > 0) {
      const ok = await confirm({
        title: "Overwrite existing per-user content?",
        message: `${overwriteCount} user${
          overwriteCount === 1 ? " already has" : "s already have"
        } a different ${manualImportField} value. Continue and replace ${
          overwriteCount === 1 ? "it" : "them"
        }?`,
        confirmLabel: "Overwrite",
        cancelLabel: "Cancel",
        mode: "fullscreen",
      });
      if (!ok) return;
    }

    onUpdate({
      manualPerUser: true,
      manualUserContent: nextManualContent,
    } as Partial<T>);

    setIsMenuOpen(false);
    success(
      `Imported content for ${importedCount} user${
        importedCount === 1 ? "" : "s"
      }.`,
    );
  }, [
    block,
    confirm,
    manualImportField,
    manualUserContent,
    onUpdate,
    success,
    toastError,
  ]);

  const clearContentForActiveUser = () => {
    if (!onUpdate || !block || !activeManualUserId) {
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

  const showConditionalControls =
    showConditionalVisibilityControl && showConditional;

  const renderContent =
    typeof children === "function"
      ? children({
          block: (effectiveBlock ?? (block as T)) as T,
          onUpdate: handleBlockUpdate,
          activeUserId: activeManualUserId,
          activeUserName: activeUser?.name,
          isDefaultContent: !manualPerUserEnabled || !activeManualUserId,
          hasContentForUser: hasContentForActiveUser,
        })
      : children;

  return (
    <div
      className={cn(
        "group relative border rounded-lg p-4 pl-8 pt-8 transition-all",
        isDragging
          ? "border-blue-400 shadow-lg opacity-50"
          : "border-gray-200 hover:border-gray-300",
      )}
    >
      <div
        className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title="Drag to reorder"
      >
        <div
          className="text-gray-400 hover:text-gray-600 p-1"
          style={{ userSelect: "none" }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
            style={{ userSelect: "none" }}
          >
            <circle cx="2" cy="2" r="1" />
            <circle cx="6" cy="2" r="1" />
            <circle cx="2" cy="6" r="1" />
            <circle cx="6" cy="6" r="1" />
            <circle cx="2" cy="10" r="1" />
            <circle cx="6" cy="10" r="1" />
          </svg>
        </div>
      </div>
      {block?.id && (
        <span
          className="absolute top-2 left-8 font-mono text-[10px] text-gray-400 px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded select-all"
          title="Block id"
        >
          {block.id}
        </span>
      )}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {showConditional && (
          <div className="relative" ref={optionsMenuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="text-gray-500 hover:text-gray-700 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <span className="sr-only">Display block options</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="3.5" cy="8" r="1.2" />
                <circle cx="8" cy="8" r="1.2" />
                <circle cx="12.5" cy="8" r="1.2" />
              </svg>
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-2 text-sm shadow-lg z-20">
                <label className="flex cursor-pointer items-center px-3 py-1.5 text-gray-700">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={showConditionalVisibilityControl}
                    onChange={(event) =>
                      handleConditionalVisibilityToggle(event.target.checked)
                    }
                  />
                  Use conditional visibility
                </label>
                <div className="mt-2 border-t border-gray-100 pt-2">
                  <label className="flex cursor-pointer items-center px-3 py-1.5 text-gray-700">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={manualPerUserEnabled}
                      onChange={(event) =>
                        handleManualToggle(event.target.checked)
                      }
                    />
                    Manual content per user
                  </label>
                  {manualImportField && onUpdate && (
                    <div className="px-3 py-1.5">
                      <button
                        type="button"
                        className="block w-full rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-100"
                        onClick={() => void handleImportFromClipboard()}
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
                                ? `${activeUser.name ?? "User"} (#${
                                    activeUser.id
                                  })`
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
                              {hasContentForActiveUser
                                ? "Custom content"
                                : "Using default"}
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
                            <span className="text-red-700">
                              {userLoadError}
                            </span>
                            <button
                              type="button"
                              className="text-blue-600 hover:text-blue-700"
                              onClick={() => void loadUsers(true)}
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
                                <span className="text-gray-500">
                                  No overrides yet
                                </span>
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
                                    onClick={() =>
                                      selectManualTarget(String(user.id))
                                    }
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
                                <span className="text-gray-500">
                                  Everyone set
                                </span>
                              ) : (
                                usersWithoutContent.slice(0, 6).map((user) => (
                                  <button
                                    key={user.id}
                                    type="button"
                                    className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] text-gray-800 hover:bg-gray-300"
                                    onClick={() =>
                                      selectManualTarget(String(user.id))
                                    }
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
              </div>
            )}
          </div>
        )}
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50"
          title="Remove field"
        >
          ×
        </button>
      </div>
      <div className={cn(showConditionalControls && "space-y-3")}>
        {manualPerUserEnabled && (
          <div className="mb-3 flex items-center justify-between rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            <div>
              <p className="text-sm font-semibold">
                {activeManualUserId
                  ? `Editing ${
                      activeUser?.name
                        ? `${activeUser.name}`
                        : `User ${activeManualUserId}`
                    }`
                  : "Editing default content"}
              </p>
              <p className="text-xs">
                {hasContentForActiveUser
                  ? "Custom content saved for this user."
                  : "Currently using the default block content."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-white px-2 py-1 text-[11px] text-gray-700">
                {paginationLabel}
              </span>
              <button
                type="button"
                className="text-xs text-gray-700 border border-gray-200 rounded px-2 py-1 hover:border-gray-300 disabled:opacity-50"
                onClick={() => handleCycleUser("prev")}
                disabled={totalManualTargets === 0}
              >
                Prev
              </button>
              <button
                type="button"
                className="text-xs text-gray-700 border border-gray-200 rounded px-2 py-1 hover:border-gray-300 disabled:opacity-50"
                onClick={() => handleCycleUser("next")}
                disabled={totalManualTargets === 0}
              >
                Next
              </button>
            </div>
          </div>
        )}
        {renderContent}
        {onUpdate && block && (
          <div className="flex w-full items-center justify-end gap-2 text-sm">
            {manualPerUserEnabled && (
              <>
                {isLoadingUsers && <span>Loading users…</span>}
                {!isLoadingUsers && manualUsers.length === 0 && (
                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-700"
                    onClick={() => void loadUsers(true)}
                  >
                    Load users
                  </button>
                )}
                <button
                  type="button"
                  className="text-gray-600 underline decoration-dotted underline-offset-2"
                  onClick={() => {
                    if (!isUserListOpen && manualUsers.length === 0) {
                      void loadUsers(true);
                    }
                    setIsUserListOpen((prev) => !prev);
                  }}
                >
                  {setCount} set / {totalUserCount} total
                </button>
              </>
            )}
          </div>
        )}
        {manualPerUserEnabled && isUserListOpen && (
          <div className="mt-2 rounded-md border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-700">
              <span className="font-medium">Users</span>
              {isLoadingUsers && (
                <span className="text-gray-500">Loading…</span>
              )}
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
        {showConditionalControls && (
          <div className="border-t border-gray-200 pt-4">
            <ConditionalVisibility
              field={effectiveBlock ?? block!}
              previousFields={previousFields || []}
              outputBlocks={outputBlocks}
              onChange={handleConditionalChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
