import { clipboardCopy } from "@alliance/shared/lib/copy";
import type { PageMenuItem } from "../../components/ui/PageMenu";
import { imageUploadingMessage } from "./actionSaveErrors";

const unsavedDuplicateMessage =
  "Save your changes on Content to duplicate this action.";

export function actionMenuItems(params: {
  archived: boolean;
  unsaved: boolean;
  imageUploading: boolean;
  onDuplicate: () => void;
  onExport: () => void;
  onArchive: () => void;
}): PageMenuItem[] {
  return [
    {
      label: "Duplicate action",
      onSelect: params.onDuplicate,
      disabledReason: params.imageUploading
        ? imageUploadingMessage
        : params.unsaved
          ? unsavedDuplicateMessage
          : undefined,
    },
    { label: clipboardCopy.exportJson, onSelect: params.onExport },
    params.archived
      ? { label: "Unarchive action", onSelect: params.onArchive }
      : {
          label: "Archive action",
          onSelect: params.onArchive,
          destructive: true,
        },
  ];
}
