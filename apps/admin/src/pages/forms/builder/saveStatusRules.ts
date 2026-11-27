export enum SaveNotice {
  Saved = "saved",
  NothingToSave = "nothingToSave",
  SourcesLoading = "sourcesLoading",
}

export type SaveStatus = { text: string; failed: boolean };

const NOTICE_TEXT: Record<SaveNotice, SaveStatus> = {
  [SaveNotice.Saved]: { text: "Saved", failed: false },
  [SaveNotice.NothingToSave]: { text: "No changes to save", failed: false },
  [SaveNotice.SourcesLoading]: {
    text: "Couldn't save: Still loading the questions of forms your formulas read. Try again in a moment.",
    failed: true,
  },
};

/** What the toolbar says about saving: one sentence, in the order it matters. */
export function saveStatusOf({
  hasUnsavedChanges,
  isSaving,
  saveError,
  notice,
}: {
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  saveError: string | null;
  notice: SaveNotice | null;
}): SaveStatus {
  if (isSaving) return { text: "Saving…", failed: false };
  if (saveError !== null) {
    return { text: `Couldn't save: ${saveError}`, failed: true };
  }
  if (notice !== null) return NOTICE_TEXT[notice];
  return { text: hasUnsavedChanges ? "Unsaved changes" : "", failed: false };
}
