import { errorMessage } from "@alliance/common/errorMessage";
import { userSendPushNotificationAdmin } from "@alliance/shared/client";
import type {
  PushDto,
  TestPushNotificationDto,
} from "@alliance/shared/client/types.gen";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import UserSelect, { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import React, { useCallback, useMemo, useState } from "react";
import { useUsersAdmin } from "../lib/useUsersAdmin";

const TestPushNotification: React.FC = () => {
  const {
    data: users = [],
    isLoading: usersLoading,
    isLoadingError: usersLoadFailed,
  } = useUsersAdmin();
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [message, setMessage] = useState("hi");
  const [sending, setSending] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [respData, setRespData] = useState<PushDto | null>(null);

  const selectableUsers = useMemo<UserSelectUser[]>(
    () =>
      users.map((user) => ({
        id: user.id,
        name: user.name || `User #${user.id}`,
        profilePicture: user.profilePicture ?? null,
      })),
    [users],
  );

  const handleSend = useCallback(async () => {
    const userId = selectedUserIds[0];
    const trimmed = message.trim();
    if (!userId) {
      setError("Select a user first.");
      return;
    }
    if (!trimmed) {
      setError("Message cannot be empty.");
      return;
    }

    setSending(true);
    try {
      const payload: TestPushNotificationDto = {
        userId,
        message: trimmed,
      };
      const response = await userSendPushNotificationAdmin({ body: payload });
      if (response.error || !response.response.ok) {
        setError(
          errorMessage({
            error: response.error,
            fallback: "Failed to send push notification.",
          }),
        );
        return;
      }
      if (response.data) {
        setRespData(response.data);
      }
      setSuccess("Push notification sent.");
      setError(null);
    } catch (err) {
      console.error("Failed to send push notification", err);
      setError("Failed to send push notification: " + (err as Error).message);
    } finally {
      setSending(false);
    }
  }, [message, selectedUserIds]);

  const canSend =
    !sending && selectedUserIds.length > 0 && message.trim().length > 0;

  return (
    <div className="p-8 flex flex-col gap-6 max-w-2xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Test Push Notification</h1>
      </div>
      <UserSelect
        users={selectableUsers}
        selectedUserIds={selectedUserIds}
        onChange={setSelectedUserIds}
        loading={usersLoading}
        loadFailed={usersLoadFailed}
        label="Recipient"
        single
      />
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700" htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          className="w-full min-h-28 border border-zinc-300 rounded px-3 py-2 text-sm"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Type a test notification message"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          color={ButtonColor.Black}
          onClick={handleSend}
          disabled={!canSend}
          className="text-sm"
        >
          {sending ? "Sending..." : "Send test push"}
        </Button>
        {sending && (
          <p className="text-sm text-zinc-500">Sending push notification...</p>
        )}
        {error && <p className="text-red-500 text-[10pt] mt-1">{error}</p>}
        {success && <p className="text-green text-[10pt] mt-1">{success}</p>}
      </div>
      {respData && (
        <pre className="text-sm text-zinc-500">
          {JSON.stringify(respData, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default TestPushNotification;
