export enum FormMode {
  /** A response already given: every field is disabled and nothing is written. */
  Completed = "completed",
  /** Fillable, but it stores nothing and submits nothing. */
  Preview = "preview",
  Live = "live",
}

/** Web and mobile both call it, so the same props mean the same thing on either. */
export function formMode({
  renderFormAsCompleted,
  hasSubmit,
  previewMode,
}: {
  renderFormAsCompleted?: boolean;
  hasSubmit: boolean;
  previewMode?: boolean;
}): FormMode {
  if (renderFormAsCompleted || (!hasSubmit && !previewMode)) {
    return FormMode.Completed;
  }
  return previewMode ? FormMode.Preview : FormMode.Live;
}
