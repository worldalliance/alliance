export function textareaMinRows(params: {
  rows?: number;
  disabled?: boolean;
  isPreview?: boolean;
}): number {
  return params.disabled && !params.isPreview ? 1 : params.rows || 3;
}
