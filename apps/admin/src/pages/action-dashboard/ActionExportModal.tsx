import { clipboardCopy } from "@alliance/shared/lib/copy";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import LargeCheckbox from "@alliance/sharedweb/ui/LargeCheckbox";
import Modal, {
  ModalActions,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import type { ActionExport } from "./useActionExport";

const ActionExportModal = ({
  actionExport: {
    exportActionOpen,
    setExportActionOpen,
    exportActionEvents,
    setExportActionEvents,
    exportActionTaskForm,
    setExportActionTaskForm,
    exportActionSuite,
    setExportActionSuite,
    jsonCopied,
    handleExportAction,
  },
}: {
  actionExport: ActionExport;
}) => (
  <Modal
    open={exportActionOpen}
    onClose={() => setExportActionOpen(false)}
    panelClassName="max-w-sm"
  >
    <ModalHeader>
      <ModalTitle className="text-base font-semibold text-zinc-900">
        {clipboardCopy.exportJson}
      </ModalTitle>
      <ModalDescription className="mt-1 text-sm text-zinc-600">
        Copies this action to the clipboard as JSON.
      </ModalDescription>
    </ModalHeader>
    <ModalBody>
      <fieldset className="flex flex-col gap-y-2 text-sm">
        <legend className="mb-2 font-medium text-zinc-900">Include</legend>
        <LargeCheckbox
          label="Events"
          checked={exportActionEvents}
          onChange={setExportActionEvents}
        />
        <LargeCheckbox
          label="Task form"
          checked={exportActionTaskForm}
          onChange={setExportActionTaskForm}
        />
        <LargeCheckbox
          label="Suite"
          checked={exportActionSuite}
          onChange={setExportActionSuite}
        />
      </fieldset>
    </ModalBody>
    <ModalFooter>
      <ModalActions>
        <Button
          color={ButtonColor.White}
          size="small"
          onClick={() => setExportActionOpen(false)}
        >
          Cancel
        </Button>
        <Button
          color={ButtonColor.Black}
          size="small"
          onClick={() => void handleExportAction()}
          disabled={jsonCopied}
        >
          {jsonCopied ? clipboardCopy.copiedToClipboard : "Copy JSON"}
        </Button>
      </ModalActions>
    </ModalFooter>
  </Modal>
);

export default ActionExportModal;
