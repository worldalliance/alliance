import { clipboardCopy } from "@alliance/shared/lib/copy";
import Button, { ButtonVariant } from "../../ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { CheckboxField } from "../../ui/templates/Form";
import type { ActionExport } from "../action-dashboard/useActionExport";

/** Picks what the task's JSON holds, then copies it for Paste JSON on the tasks list. */
export function ExportTaskDialog({
  actionExport,
}: {
  actionExport: ActionExport;
}) {
  const {
    exportActionEvents,
    setExportActionEvents,
    exportActionTaskForm,
    setExportActionTaskForm,
    exportActionSuite,
    setExportActionSuite,
    jsonCopied,
    exportError,
    handleExportActionOpen,
    handleExportAction,
  } = actionExport;
  return (
    <Modal onClose={() => void handleExportActionOpen()}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleExportAction();
        }}
      >
        <ModalHeader>
          <ModalTitle>Export JSON</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <p className="text-fg-muted">
            Copies the task's details and settings, its visibility and cohort
            included. Reminders are never exported.
          </p>
          <CheckboxField
            label="Events"
            help="The task's events with their dates."
            checked={exportActionEvents}
            onChange={(event) => setExportActionEvents(event.target.checked)}
          />
          <CheckboxField
            label="Form"
            help="The task's form as it is now."
            checked={exportActionTaskForm}
            onChange={(event) => setExportActionTaskForm(event.target.checked)}
          />
          <CheckboxField
            label="Suite"
            help="The suite's name. A paste joins the suite with that name, or creates it."
            checked={exportActionSuite}
            onChange={(event) => setExportActionSuite(event.target.checked)}
          />
        </ModalBody>
        <ModalFooter error={exportError}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={() => void handleExportActionOpen()}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              disabled={jsonCopied}
            >
              {jsonCopied ? clipboardCopy.inClipboard : "Copy JSON"}
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
