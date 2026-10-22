import {
  SETTINGS_LOAD_FAILED,
  SETTINGS_LOADING,
} from "@alliance/shared/lib/notificationSettings";
import LoadFailed, { type LoadFailure } from "../LoadFailed";

export default function NotificationSettingsPending({
  loadFailed,
  ...failure
}: LoadFailure & { loadFailed: boolean }) {
  return loadFailed ? (
    <LoadFailed message={SETTINGS_LOAD_FAILED} {...failure} />
  ) : (
    <p className="text-zinc-500">{SETTINGS_LOADING}</p>
  );
}
