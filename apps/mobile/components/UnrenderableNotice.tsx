import { UnrenderableReason } from "@alliance/common/forms/unrenderable";
import {
  CONTENT_PROBLEM_ADVICE,
  unrenderableTitle,
  type UnrenderableSubject,
} from "@alliance/shared/forms/unrenderable";
import { useUnstableGlobalHref } from "expo-router";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Linking,
  View,
} from "react-native";
import { fetchAvailableUpdate, OTA_UPDATES_ENABLED } from "../lib/otaUpdates";
import { restartIntoUpdate } from "../lib/restartIntoUpdate";
import { shareInFlight } from "../lib/shareInFlight";
import { STORE, storeHasNewerBuild } from "../lib/storeUpdate";
import { colors } from "../lib/style/colors";
import {
  searchForNewerVersion,
  type UpdateSearchOutcome,
} from "../lib/updateSearch";
import Button, { ButtonColor } from "./system/Button";
import Text, { FontWeight } from "./system/Text";
import { RecoveryAction, updateRecoveryView } from "./updateRecoveryView";

const search = shareInFlight(() =>
  searchForNewerVersion({
    fetchOta: fetchAvailableUpdate,
    storeHasNewer: storeHasNewerBuild,
  }),
);

// Shared by every notice, so a feed of cards that mount or change together
// announces their message once, while a later screen's notice still announces.
const ANNOUNCE_REPEAT_GAP_MS = 2000;
let lastAnnounced: { message: string; at: number } | null = null;

export default function UnrenderableNotice({
  subject,
  reason,
}: {
  subject: UnrenderableSubject;
  reason: UnrenderableReason;
}) {
  return (
    <View className="gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
      <Text weight={FontWeight.Medium} className="text-amber-900">
        {unrenderableTitle(subject, reason)}
      </Text>
      <Remedy subject={subject} reason={reason} />
    </View>
  );
}

function Remedy({
  subject,
  reason,
}: {
  subject: UnrenderableSubject;
  reason: UnrenderableReason;
}) {
  switch (reason) {
    case UnrenderableReason.OutdatedClient:
      return <UpdateRecovery subject={subject} />;
    case UnrenderableReason.ContentProblem:
      return (
        <Text className="text-sm text-amber-900">{CONTENT_PROBLEM_ADVICE}</Text>
      );
    default:
      throw new Error(`unknown reason: ${reason satisfies never}`);
  }
}

function UpdateRecovery({ subject }: { subject: UnrenderableSubject }) {
  const { isUpdatePending } = Updates.useUpdates();
  const route = useUnstableGlobalHref();
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<UpdateSearchOutcome | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [restartFailed, setRestartFailed] = useState(false);
  const ready = OTA_UPDATES_ENABLED && isUpdatePending;

  useEffect(() => {
    if (ready) return;
    let current = true;
    setOutcome(null);
    void search().then((found) => {
      if (current) setOutcome(found);
    });
    return () => {
      current = false;
    };
  }, [attempt, ready]);

  const restart = async () => {
    setRestarting(true);
    setRestartFailed(false);
    if (!(await restartIntoUpdate(route))) {
      setRestarting(false);
      setRestartFailed(true);
    }
  };

  const view = updateRecoveryView({
    subject,
    ready,
    restartFailed,
    outcome,
    store: STORE,
  });
  const button = recoveryButton({
    action: view.action,
    restarting,
    restart: () => void restart(),
    retry: () => setAttempt((n) => n + 1),
  });

  useEffect(() => {
    const now = Date.now();
    if (
      lastAnnounced?.message === view.message &&
      now - lastAnnounced.at < ANNOUNCE_REPEAT_GAP_MS
    ) {
      return;
    }
    lastAnnounced = { message: view.message, at: now };
    AccessibilityInfo.announceForAccessibility(view.message);
  }, [view.message]);

  return (
    <>
      <View className="flex-row items-center gap-2">
        {outcome === null && !ready && (
          <ActivityIndicator color={colors.green} />
        )}
        <Text className="flex-1 text-sm text-amber-900">{view.message}</Text>
      </View>
      {button !== null && <View className="items-start">{button}</View>}
    </>
  );
}

function recoveryButton(params: {
  action: RecoveryAction | null;
  restarting: boolean;
  restart: () => void;
  retry: () => void;
}): React.ReactElement | null {
  const { action, restarting, restart, retry } = params;
  if (action === null) return null;
  switch (action) {
    case RecoveryAction.Restart:
      return (
        <Button
          title="Restart to update"
          color={ButtonColor.Black}
          loading={restarting}
          disabled={restarting}
          onPress={restart}
        />
      );
    case RecoveryAction.OpenStore: {
      const store = STORE;
      if (store === null) return null;
      return (
        <Button
          title={`Open ${store.name}`}
          color={ButtonColor.Black}
          onPress={() => void Linking.openURL(store.url)}
        />
      );
    }
    case RecoveryAction.Retry:
      return (
        <Button title="Try again" color={ButtonColor.Black} onPress={retry} />
      );
    default:
      throw new Error(`unknown action: ${action satisfies never}`);
  }
}
