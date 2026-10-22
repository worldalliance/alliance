import {
  SETTINGS_LOAD_FAILED,
  SETTINGS_LOADING,
} from "@alliance/shared/lib/notificationSettings";
import LoadFailed from "../LoadFailed";
import Text from "../system/Text";

export default function NotificationSettingsPending({
  loadFailed,
  ...failure
}: {
  loadFailed: boolean;
  onRetry: () => void;
  retrying: boolean;
}) {
  return loadFailed ? (
    <LoadFailed message={SETTINGS_LOAD_FAILED} {...failure} />
  ) : (
    <Text className="text-zinc-500">{SETTINGS_LOADING}</Text>
  );
}
