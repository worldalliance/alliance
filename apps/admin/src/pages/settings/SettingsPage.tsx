import type { PushDto } from "@alliance/shared/client/types.gen";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import { PlaceId } from "../../places";
import { cn } from "../../ui/cn";
import {
  Field,
  FormSection,
  SAVE_FAILED_FALLBACK,
  SaveBar,
  SaveState,
  useFocusFirstInvalid,
} from "../../ui/templates/Form";
import { Page, PageBody } from "../../ui/templates/Page";
import { Textarea } from "../../ui/Textarea";
import UserSelect, { type UserSelectUser } from "../../ui/UserSelect";
import { pushFailureReason } from "./testPushRules";
import { useSendTestPush } from "./useSendTestPush";

// A 5xx can repeat on every try: a device token not in Expo's format makes the
// server throw. Only a send that got no answer is told to try again.
const SERVER_FAILED = "The server hit an error sending it.";

const STATE_TEXT = {
  [SaveState.Saving]: "Sending…",
  [SaveState.Saved]: "Sent: Expo accepted it for delivery",
  [SaveState.Failed]: "Couldn't send",
};

export default function SettingsPage() {
  const users = useUsersAdmin();
  const [recipientIds, setRecipientIds] = useState<number[]>([]);
  const [message, setMessage] = useState("hi");
  const [errors, setErrors] = useState<{
    recipient?: string;
    message?: string;
  }>({});
  // The bar speaks of the last send only until the form changes. The server's
  // response stays below so the page never shrinks under the pointer, marked
  // as an earlier send's once a later send fails.
  const [editedSinceSend, setEditedSinceSend] = useState(false);
  const [lastPush, setLastPush] = useState<{
    push: PushDto;
    recipient: string;
    fromEarlierSend: boolean;
  }>();
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const send = useSendTestPush();
  const confirm = useConfirmOnPage();

  const selectableUsers = useMemo<UserSelectUser[]>(
    () =>
      (users.data ?? []).map((user) => ({
        id: user.id,
        name: user.name || `User #${user.id}`,
        profilePicture: user.profilePicture ?? null,
      })),
    [users.data],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (send.isPending) return;
    const userId = recipientIds[0];
    const trimmed = message.trim();
    if (userId === undefined || !trimmed) {
      setErrors({
        recipient: userId === undefined ? "Choose a member" : undefined,
        message: trimmed ? undefined : "Enter a message",
      });
      focusFirstInvalid();
      return;
    }
    const recipient =
      selectableUsers.find((user) => user.id === userId)?.name ?? "the member";
    const confirmed = await confirm({
      title: `Send a test push to ${recipient}?`,
      message: `It goes to one of ${recipient}'s devices as a real notification and can't be recalled.`,
      confirmLabel: "Send push",
    });
    if (!confirmed) return;
    setEditedSinceSend(false);
    send.mutate(
      { userId, message: trimmed },
      {
        onSuccess: (push) =>
          setLastPush({ push, recipient, fromEarlierSend: false }),
        onError: () =>
          setLastPush(
            (current) => current && { ...current, fromEarlierSend: true },
          ),
      },
    );
  };

  const refusal = send.isError
    ? adminRefusalMessage(
        send.error,
        thrownStatus(send.error) === undefined
          ? SAVE_FAILED_FALLBACK
          : SERVER_FAILED,
      )
    : send.data
      ? pushFailureReason(send.data)
      : null;
  const state = send.isPending
    ? SaveState.Saving
    : editedSinceSend || send.isIdle
      ? SaveState.Clean
      : refusal
        ? SaveState.Failed
        : SaveState.Saved;

  return (
    <Page place={PlaceId.Settings}>
      <PageBody width="form">
        <form ref={formRef} onSubmit={submit} noValidate>
          <FormSection
            title="Developer tools"
            footer={
              <SaveBar
                state={state}
                saveLabel="Send test push"
                stateText={STATE_TEXT}
                error={refusal}
              />
            }
          >
            <div className="flex flex-col gap-1 border-b border-line pb-4">
              <h3 className="font-semibold">Send test push</h3>
              <p className="text-fg-muted">
                Sends your message as a real push notification to one of the
                member&apos;s devices, to check that delivery works. A member
                with several devices gets it on one only, and the send is
                refused when the member has no device or that device has no push
                token.
              </p>
            </div>
            <Field label="Recipient" error={errors.recipient}>
              {(control) => (
                <UserSelect
                  {...control}
                  label={null}
                  users={selectableUsers}
                  selectedUserIds={recipientIds}
                  onChange={(ids) => {
                    setRecipientIds(ids);
                    setErrors((current) => ({
                      ...current,
                      recipient: undefined,
                    }));
                    setEditedSinceSend(true);
                  }}
                  loading={users.isLoading}
                  loadFailed={users.isLoadingError}
                  single
                />
              )}
            </Field>
            <Field
              label="Message"
              help="Shown to the member as the notification's text."
              error={errors.message}
            >
              {(control) => (
                <Textarea
                  {...control}
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    setErrors((current) => ({
                      ...current,
                      message: undefined,
                    }));
                    setEditedSinceSend(true);
                  }}
                />
              )}
            </Field>
          </FormSection>
        </form>

        {lastPush && (
          <FormSection
            title="Server response"
            description={
              lastPush.fromEarlierSend
                ? `The last send failed. This is the push an earlier send recorded for ${lastPush.recipient}.`
                : `The push the server recorded for ${lastPush.recipient}.`
            }
          >
            <pre
              aria-label="Push record as JSON"
              tabIndex={0}
              className={cn(
                "overflow-x-auto rounded-md bg-surface-2 p-3 font-mono text-xs focus-ring",
                lastPush.fromEarlierSend && "text-fg-muted",
              )}
            >
              {JSON.stringify(lastPush.push, null, 2)}
            </pre>
          </FormSection>
        )}
      </PageBody>
    </Page>
  );
}
