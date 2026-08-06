import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Modal, {
  ModalActions,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import React from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // `e.repeat` guards the dialog's own opening keystroke: holding Enter on
    // the trigger keeps delivering keydowns, and repeats retarget to whatever
    // now has focus — by then, the panel.
    if (isLoading || e.key !== "Enter" || e.shiftKey || e.repeat) return;
    // Only while the panel shell itself holds focus. Once focus is on a control
    // inside, that control owns the key: preventing its default would swallow
    // its own activation and confirm instead — notably on Cancel.
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    onConfirm();
  };

  return (
    <Modal
      open={isOpen}
      onClose={onCancel}
      onKeyDown={handleKeyDown}
      dismissOnBackdrop={false}
      dismissDisabled={isLoading}
      showClose={false}
      panelClassName="max-w-2xl max-h-[90vh] flex flex-col"
    >
      <ModalHeader className="p-6">
        <ModalTitle
          render={<h3 />}
          className="text-lg font-medium text-gray-900"
        >
          {title}
        </ModalTitle>
      </ModalHeader>

      <div className="flex-1 overflow-y-auto p-6">
        <ModalDescription className="text-sm text-gray-600 whitespace-pre-wrap break-words">
          {message}
        </ModalDescription>
      </div>

      <ModalFooter className="p-6">
        <ModalActions>
          <Button
            color={ButtonColor.White}
            size="small"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            color={ButtonColor.Black}
            size="small"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Updating..." : "Confirm"}
          </Button>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
};

export default ConfirmDialog;
