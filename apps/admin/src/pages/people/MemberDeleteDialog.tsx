// eslint-disable-next-line api-client/named-hooks-only -- file upload; its result is used once, not cached
import {
  type DeleteUserAdminDto,
  imagesUploadImage,
} from "@alliance/shared/client";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import Button, { ButtonVariant } from "../../ui/Button";
import { FileInput } from "../../ui/FileInput";
import { Input } from "../../ui/Input";
import Modal, {
  ModalActions,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Field, useFocusFirstInvalid } from "../../ui/templates/Form";
import { Textarea } from "../../ui/Textarea";

type Screenshot =
  | { state: "none" }
  | { state: "uploading"; file: File }
  | { state: "uploaded"; file: File; key: string };

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("unreadable"));
    reader.onerror = () => reject(new Error("unreadable"));
    reader.readAsDataURL(file);
  });

/**
 * Deletes a member's account after a reason and their email typed back. The
 * server refuses a mismatched email and the admin's own account.
 */
export function MemberDeleteDialog({
  member,
  deleteAccount,
  onCancel,
  onDeleted,
}: {
  member: { name: string; email: string };
  deleteAccount: (body: DeleteUserAdminDto) => Promise<unknown>;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [screenshot, setScreenshot] = useState<Screenshot>({ state: "none" });
  const [submitted, setSubmitted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();

  const emailMatches =
    confirmationEmail.trim().toLowerCase() === member.email.trim().toLowerCase();
  const reasonError =
    submitted && !reason.trim() ? "Enter why the account is being deleted" : null;
  const emailError =
    confirmationEmail.length > 0 && !emailMatches
      ? `Does not match ${member.email}`
      : submitted && !emailMatches
        ? `Type ${member.email} to confirm`
        : null;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setRefusal(null);
    setScreenshot({ state: "uploading", file });
    try {
      const { data } = await imagesUploadImage({
        body: { file: await readAsDataUrl(file) },
        throwOnError: true,
      });
      setScreenshot({ state: "uploaded", file, key: data.key });
    } catch (error) {
      console.error("Failed to upload screenshot", error);
      setScreenshot({ state: "none" });
      setRefusal(
        error instanceof Error && error.message === "unreadable"
          ? "Couldn't read that file."
          : adminRefusalMessage(error, "Couldn't upload the screenshot."),
      );
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!reason.trim() || !emailMatches) {
      focusFirstInvalid();
      return;
    }
    if (screenshot.state === "uploading") {
      setRefusal("Wait for the screenshot to finish uploading.");
      return;
    }
    setDeleting(true);
    setRefusal(null);
    try {
      await deleteAccount({
        reason: reason.trim(),
        confirmationEmail: confirmationEmail.trim(),
        screenshotKey: screenshot.state === "uploaded" ? screenshot.key : null,
      });
      onDeleted();
    } catch (error) {
      console.error("Failed to delete account", error);
      setRefusal(adminRefusalMessage(error, "Couldn't delete the account."));
      setDeleting(false);
    }
  };

  return (
    <Modal
      onClose={onCancel}
      dismissOnBackdrop={false}
      dismissDisabled={deleting}
      showClose={false}
      panelClassName="max-w-lg"
    >
      <form ref={formRef} onSubmit={(event) => void submit(event)} noValidate>
        <ModalHeader>
          <ModalTitle>Delete {member.name}'s account?</ModalTitle>
          <ModalDescription className="mt-2 text-fg-muted">
            This hides the account and everything attached to it (forum posts
            and comments, task activity, messages and notifications) and ends
            every session it has. Task completion counts drop with it. An
            operator can restore the records from the database, but not their
            links to other records: groups, likes, tags, reminders, the members
            it referred or invited, and its name on staff actions such as
            cohort corrections and waitlist emails.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <Field
            label="Reason"
            help="Posted to Slack with your name, and kept in the event log. Not stored on the account."
            error={reasonError}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                value={reason}
                disabled={deleting}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </Field>
          <Field
            label="Screenshot"
            mark="optional"
            help={
              screenshot.state === "uploading"
                ? "Uploading…"
                : "The request email, if there is one. It is linked in the Slack post."
            }
          >
            {(control) => (
              <div className="flex items-center gap-2">
                <FileInput
                  {...control}
                  accept="image/*"
                  className="flex-1"
                  value={screenshot.state === "none" ? [] : [screenshot.file]}
                  disabled={deleting || screenshot.state === "uploading"}
                  onChange={(files) => void upload(files[0])}
                />
                {screenshot.state === "uploaded" && (
                  <Button
                    size="small"
                    variant={ButtonVariant.Ghost}
                    disabled={deleting}
                    onClick={() => setScreenshot({ state: "none" })}
                  >
                    Remove
                  </Button>
                )}
              </div>
            )}
          </Field>
          <Field
            label="Type the member's email address to confirm"
            error={emailError}
          >
            {(control) => (
              <Input
                {...control}
                autoComplete="off"
                placeholder={member.email}
                value={confirmationEmail}
                disabled={deleting}
                onChange={(event) => setConfirmationEmail(event.target.value)}
              />
            )}
          </Field>
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onCancel}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant={ButtonVariant.Danger} type="submit" busy={deleting}>
              Delete account
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
