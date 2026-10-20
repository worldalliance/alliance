import {
  MANUAL_IMPORT_FIELD_BY_KIND,
  manualImportClipboardSchema,
  type DisplayBlock,
} from "@alliance/common/forms/display-blocks";
import { pickForCount, withCount } from "@alliance/common/plural";
import { ConfirmMode, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useLayoutEffect, useRef } from "react";
import type { AddressedWrite } from "../../lib/displayBlockById";
import { importManualContent, writeBlockFor } from "./perUserContent";

/**
 * Call it from a component that outlives the options menu: the menu can close,
 * unmounting what it renders, before the clipboard read resolves.
 */
export function useClipboardImport<T extends DisplayBlock>({
  block,
  onUpdate,
  updateCurrent,
  closeMenu,
}: {
  block: T | undefined;
  onUpdate: ((updates: Partial<T>) => void) | undefined;
  updateCurrent: AddressedWrite | undefined;
  closeMenu: () => void;
}): () => Promise<void> {
  const manualImportField = block
    ? MANUAL_IMPORT_FIELD_BY_KIND[block.kind]
    : null;
  const { success, error: toastError, confirm } = useToast();

  // An import awaits the clipboard before counting what it would replace.
  const latestBlock = useRef(block);
  useLayoutEffect(() => {
    latestBlock.current = block;
  });

  return async () => {
    if (!onUpdate || !block || !manualImportField) return;
    let clipboardText: string;
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch (err) {
      console.error("Could not read from clipboard", err);
      toastError("Could not read from clipboard.");
      return;
    }
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(clipboardText);
    } catch (err) {
      console.error("Could not parse clipboard JSON", err);
      toastError("Clipboard does not contain valid JSON.");
      return;
    }
    const parseResult = manualImportClipboardSchema.safeParse(rawJson);
    if (!parseResult.success) {
      toastError('Expected a JSON object like {"42": "text for user 42"}.');
      return;
    }
    const entries = parseResult.data;

    if (Object.keys(entries).length === 0) {
      toastError("No string entries found in clipboard JSON.");
      return;
    }
    const readBlock = latestBlock.current;
    if (!readBlock) return;
    const { imported, overwritten } = importManualContent({
      block: readBlock,
      field: manualImportField,
      entries,
    });
    if (imported === 0) {
      toastError("Clipboard content already matches existing per-user values.");
      return;
    }

    if (overwritten > 0) {
      const ok = await confirm({
        title: "Overwrite existing per-user content?",
        message: `${withCount(overwritten, "user")} already ${pickForCount(overwritten, "has", "have")} a different ${manualImportField} value. Continue and replace ${pickForCount(overwritten, "it", "them")}?`,
        confirmLabel: "Overwrite",
        cancelLabel: "Cancel",
        mode: ConfirmMode.Fullscreen,
      });
      if (!ok) return;
    }

    // The form can change while the clipboard is read or the admin confirms.
    const landing = writeBlockFor({
      block,
      userId: null,
      update: (current) =>
        ({
          manualPerUser: true,
          manualUserContent: importManualContent({
            block: current,
            field: manualImportField,
            entries,
          }).manualUserContent,
        }) as Partial<T>,
      updateCurrent,
      onUpdate,
    });

    closeMenu();
    if (!landing) {
      toastError("The block was deleted before its content was imported.");
      return;
    }
    success(`Imported content for ${withCount(imported, "user")}.`);
  };
}
