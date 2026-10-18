import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type MutationState,
  type MutationStatus,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  notificationSettingsGet,
  notificationSettingsUpdate,
  type KindSettingsDto,
  type NotificationCellDto,
  type NotificationChannel,
  type NotificationKind,
  type NotificationSettingsDto,
} from "../client";
import { failedToLoad } from "./failedToLoad";
import {
  defaultOf,
  resetChanges,
  targetKey,
  updateBody,
  withChanges,
  type SettingChange,
  type SettingTarget,
} from "./notificationSettings";
import { queryKeys } from "./queryKeys";

export enum SaveStatus {
  Saving = "saving",
  Saved = "saved",
  Failed = "failed",
}

export type SettingsControls = Pick<
  ReturnType<typeof useNotificationSettings>,
  "save" | "retry" | "statusOf" | "shownOverride" | "resetOf"
>;

const SAVE_KEY = ["notificationSettingsUpdate"] as const;

const SAVE_STATUS: Record<MutationStatus, SaveStatus> = {
  idle: SaveStatus.Saving,
  pending: SaveStatus.Saving,
  success: SaveStatus.Saved,
  error: SaveStatus.Failed,
};

/**
 * The member's notification settings, saved one control at a time.
 * `settings` includes saves in flight. A failed save stays out of it, since
 * the server's settings stay as they were, and shows only on its own control
 * through `shownDefault` and `shownOverride`, which the member can retry.
 * Saves live in the mutation cache, so a screen opened after one fails still
 * shows it.
 */
export function useNotificationSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.notificationSettings(),
    queryFn: () =>
      notificationSettingsGet({ throwOnError: true }).then((r) => r.data),
  });

  // Each response carries every setting, so saves run one at a time across
  // every screen. A fetch in flight when a save lands read the settings
  // before it, so it gives way to one that reads after.
  const { mutate } = useMutation({
    mutationKey: SAVE_KEY,
    scope: { id: "notificationSettings" },
    gcTime: Infinity,
    mutationFn: async (changes: readonly SettingChange[]) => {
      const { data } = await notificationSettingsUpdate({
        body: updateBody(changes),
        throwOnError: true,
      });
      const queryKey = queryKeys.notificationSettings();
      const fetching = queryClient.isFetching({ queryKey }) > 0;
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, data);
      if (fetching) void queryClient.invalidateQueries({ queryKey });
    },
  });

  const saves = useMutationState({
    filters: { mutationKey: SAVE_KEY },
    // Only this hook's mutations carry SAVE_KEY, and their variables are always changes.
    select: (mutation) =>
      mutation.state as MutationState<void, Error, readonly SettingChange[]>,
  });

  const latest = useMemo(() => {
    const byTarget = new Map<
      string,
      { change: SettingChange; status: SaveStatus }
    >();
    for (const save of saves) {
      for (const change of save.variables ?? []) {
        byTarget.set(targetKey(change), {
          change,
          status: SAVE_STATUS[save.status],
        });
      }
    }
    return byTarget;
  }, [saves]);

  const save = useCallback(
    (changes: readonly SettingChange[]) => {
      if (changes.length) mutate(changes);
    },
    [mutate],
  );

  const failed = useCallback(
    (target: SettingTarget): SettingChange | null => {
      const entry = latest.get(targetKey(target));
      return entry?.status === SaveStatus.Failed ? entry.change : null;
    },
    [latest],
  );

  const retry = useCallback(
    (target: SettingTarget) => {
      const change = failed(target);
      if (change) save([change]);
    },
    [failed, save],
  );

  const shownDefault = useCallback(
    (settings: NotificationSettingsDto, channel: NotificationChannel) => {
      const change = failed({ type: "default", channel });
      return change?.type === "default"
        ? change.value
        : defaultOf(settings, channel);
    },
    [failed],
  );

  const shownOverride = useCallback(
    (kind: NotificationKind, cell: NotificationCellDto) => {
      const change = failed({ type: "cell", kind, channel: cell.channel });
      return change ? change.value : cell.override;
    },
    [failed],
  );

  const resetOf = useCallback(
    (kind: KindSettingsDto) =>
      resetChanges({
        ...kind,
        cells: kind.cells.map((cell) => ({
          ...cell,
          override: shownOverride(kind.kind, cell),
        })),
      }),
    [shownOverride],
  );

  const statusOf = useCallback(
    (target: SettingTarget): SaveStatus | null =>
      latest.get(targetKey(target))?.status ?? null,
    [latest],
  );

  const settings = useMemo<NotificationSettingsDto | undefined>(
    () =>
      query.data &&
      withChanges(
        query.data,
        [...latest.values()]
          .filter((entry) => entry.status === SaveStatus.Saving)
          .map((entry) => entry.change),
      ),
    [query.data, latest],
  );

  return {
    settings,
    loadFailed: failedToLoad(query),
    retrying: query.isFetching,
    refetch: query.refetch,
    save,
    retry,
    statusOf,
    shownDefault,
    shownOverride,
    resetOf,
  };
}
