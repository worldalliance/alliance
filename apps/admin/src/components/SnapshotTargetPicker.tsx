import Modal, {
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import React from "react";
import { type SnapshotMigrationTarget } from "../lib/navigation";

export type SnapshotTargetPickerProps = {
  targets: SnapshotMigrationTarget[];
  onSelect: (target: SnapshotMigrationTarget) => void;
  onCancel: () => void;
};

export const SnapshotTargetPicker: React.FC<SnapshotTargetPickerProps> = ({
  targets,
  onSelect,
  onCancel,
}) => {
  return (
    <Modal onClose={onCancel}>
      <ModalHeader>
        <ModalTitle className="text-lg font-semibold">
          Reassign snapshots
        </ModalTitle>
        <ModalDescription className="text-sm text-zinc-600">
          Each form variant keeps its own schema snapshots. Pick the one whose
          responses you want to repoint at its current schema.
        </ModalDescription>
      </ModalHeader>
      <div className="flex flex-col gap-2 p-5">
        {targets.map((target) => (
          <button
            key={target.formId}
            onClick={() => onSelect(target)}
            className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-2.5 text-left text-sm hover:border-black hover:bg-gray-50"
          >
            <span className="font-medium text-gray-900">{target.name}</span>
            <span className="text-xs text-zinc-500">form #{target.formId}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
};

export default SnapshotTargetPicker;
