import React from "react";
import UiConfirmDialog from "../ui/ConfirmDialog";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** Styles the confirm button as danger and drops the Enter shortcut, so the destructive step is never the default. */
  destructive?: boolean;
}

/** The props of the dialog this one replaced. New code renders `ui/ConfirmDialog`. */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
  isLoading = false,
  destructive = false,
}) => (
  <UiConfirmDialog
    open={isOpen}
    title={title}
    message={message}
    confirmLabel={isLoading ? "Updating..." : confirmLabel}
    onConfirm={onConfirm}
    onCancel={onCancel}
    busy={isLoading}
    destructive={destructive}
  />
);

export default ConfirmDialog;
