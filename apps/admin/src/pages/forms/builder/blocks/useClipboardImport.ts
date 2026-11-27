import {
  MANUAL_IMPORT_FIELD_BY_KIND,
  manualImportClipboardSchema,
  type DisplayBlock,
} from "@alliance/common/forms/display-blocks";
import { pickForCount, withCount } from "@alliance/common/plural";
import { useLayoutEffect, useRef } from "react";
import type { AddressedWrite } from "../../../../lib/displayBlockById";
import { ConfirmMode, useToast } from "../../../../ui/ToastProvider";
import { importManualContent, writeBlockFor } from "./perUserContent";

/**
 * Resolves to why nothing was imported, for the control that started it to say
 * under itself, or null once the import landed or the admin declined it.
 *
 * Call it from a component that outlives the control that starts it, which
 * can unmount before the clipboard read resolves.
 */
export function useClipboardImport<T extends DisplayBlock>({
  block,
  onUpdate,
  updateCurrent,
}: {
  block: T | undefined;
  onUpdate: ((updates: Partial<T>) => void) | undefined;
  updateCurrent: AddressedWrite | undefined;
}): () => Promise<string | null> {
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
    if (!onUpdate || !block || !manualImportField) return null;
    let clipboardText: string;
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch (err) {
      console.error("Could not read from clipboard", err);
      return "Could not read from clipboard.";
    }
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(clipboardText);
    } catch (err) {
      console.error("Could not parse clipboard JSON", err);
      return "Clipboard does not contain valid JSON.";
    }
    const parseResult = manualImportClipboardSchema.safeParse(rawJson);
    if (!parseResult.success) {
      return 'Expected a JSON object like {"42": "text for user 42"}.';
    }
    const entries = parseResult.data;

    if (Object.keys(entries).length === 0) {
      return "No string entries found in clipboard JSON.";
    }
    const readBlock = latestBlock.current;
    if (!readBlock) return null;
    const { imported, overwritten } = importManualContent({
      block: readBlock,
      field: manualImportField,
      entries,
    });
    if (imported === 0) {
      return "Clipboard content already matches existing per-user values.";
    }

    if (overwritten > 0) {
      const ok = await confirm({
        title: "Overwrite existing per-user content?",
        message: `${withCount(overwritten, "user")} already ${pickForCount(overwritten, "has", "have")} a different ${manualImportField} value. Continue and replace ${pickForCount(overwritten, "it", "them")}?`,
        confirmLabel: "Overwrite",
        cancelLabel: "Cancel",
        mode: ConfirmMode.Fullscreen,
      });
      if (!ok) return null;
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

    if (!landing) {
      // The block's controls are gone with it, so no inline line is left to say so.
      toastError("The block was deleted before its content was imported.");
      return null;
    }
    success(`Imported content for ${withCount(imported, "user")}.`);
    return null;
  };
}
