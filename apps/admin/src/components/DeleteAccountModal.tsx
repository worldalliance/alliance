import { errorMessage } from "@alliance/common/errorMessage";
import {
  imagesUploadImage,
  userDeleteUserAdmin,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import Modal, {
  ModalActions,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import { AlertTriangle, Paperclip, X } from "lucide-react";
import React, { useCallback, useState } from "react";

interface DeleteAccountModalProps {
  userId: number;
  userName: string;
  userEmail: string;
  onCancel: () => void;
  onDeleted: () => void;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  userId,
  userName,
  userEmail,
  onCancel,
  onDeleted,
}) => {
  const [reason, setReason] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [screenshotKey, setScreenshotKey] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailMatches =
    confirmationEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
  const canDelete =
    reason.trim().length > 0 && emailMatches && !isUploading && !isDeleting;

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      setError(null);

      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result !== "string") {
          setError("Could not read that file.");
          setIsUploading(false);
          return;
        }
        try {
          const { data } = await imagesUploadImage({
            body: { file: reader.result },
          });
          if (data) {
            setScreenshotKey(data.key);
            setScreenshotName(file.name);
          }
        } catch (uploadError) {
          console.error("Failed to upload screenshot", uploadError);
          setError("Failed to upload the screenshot. Try again.");
        } finally {
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        setError("Could not read that file.");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const handleDelete = useCallback(async () => {
    if (!canDelete) return;

    setIsDeleting(true);
    setError(null);
    try {
      await userDeleteUserAdmin({
        path: { id: userId },
        body: {
          reason: reason.trim(),
          confirmationEmail: confirmationEmail.trim(),
          screenshotKey,
        },
        throwOnError: true,
      });
      onDeleted();
    } catch (deleteError) {
      console.error("Failed to delete account", deleteError);
      setError(
        errorMessage({
          error: deleteError,
          fallback: "Failed to delete the account.",
        }),
      );
      setIsDeleting(false);
    }
  }, [canDelete, confirmationEmail, onDeleted, reason, screenshotKey, userId]);

  return (
    <Modal
      onClose={onCancel}
      dismissOnBackdrop={false}
      dismissDisabled={isDeleting}
      showClose={false}
      panelClassName="flex max-h-[90vh] max-w-lg flex-col overflow-hidden"
    >
      <ModalHeader className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div>
          <ModalTitle className="text-lg font-semibold">
            Delete {userName}&apos;s account
          </ModalTitle>
          <ModalDescription className="text-sm text-zinc-600">
            This permanently deletes the account and everything attached to it —
            forum posts and comments, action activity, and messages. Action
            completion counts will drop accordingly. This cannot be undone.
          </ModalDescription>
        </div>
      </ModalHeader>

      <ModalBody className="flex flex-col gap-4 overflow-auto">
        <div className="flex flex-col gap-1">
          <label
            className="text-base mb-1 text-black"
            htmlFor="delete-account-reason"
          >
            Reason
          </label>
          <textarea
            id="delete-account-reason"
            name="delete-account-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            disabled={isDeleting}
            placeholder="Why is this account being deleted?"
            className="border rounded px-3 py-2 bg-white focus:outline-none text-[11pt] border-zinc-300 focus:border-zinc-500"
          />
          <p className="text-xs text-zinc-500">
            Posted to Slack with your name. Not stored on the account.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-base text-black">Screenshot (optional)</span>
          {screenshotKey ? (
            <div className="flex items-center gap-2 text-sm text-zinc-700">
              <Paperclip size={16} className="text-zinc-500" />
              <span className="truncate">{screenshotName}</span>
              <button
                type="button"
                onClick={() => {
                  setScreenshotKey(null);
                  setScreenshotName(null);
                }}
                disabled={isDeleting}
                aria-label="Remove screenshot"
                title="Remove screenshot"
                className="text-zinc-500 hover:text-zinc-800"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isUploading || isDeleting}
              className="text-sm file:mr-2 file:rounded file:border file:border-zinc-300 file:bg-white file:px-2 file:py-1 file:text-sm"
            />
          )}
          <p className="text-xs text-zinc-500">
            {isUploading
              ? "Uploading…"
              : "Attach the request email if you have one — it is linked in the Slack post."}
          </p>
        </div>

        <FormInput
          name="delete-account-confirmation"
          label="Type the member's email address to confirm"
          value={confirmationEmail}
          onChange={(event) => setConfirmationEmail(event.target.value)}
          placeholder={userEmail}
          disabled={isDeleting}
          error={
            confirmationEmail.length > 0 && !emailMatches
              ? `Does not match ${userEmail}`
              : undefined
          }
        />
      </ModalBody>

      <ModalFooter className="p-4">
        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
        <ModalActions className="justify-end">
          <Button
            color={ButtonColor.White}
            size="small"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            color={ButtonColor.Red}
            size="small"
            onClick={handleDelete}
            disabled={!canDelete}
          >
            {isDeleting ? "Deleting…" : "Delete account"}
          </Button>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
};

export default DeleteAccountModal;
