import { CopyField } from "../../../../ui/CopyField";

/** An element's, page's or option's id, read-only, with a Copy button. */
export function ReadOnlyId({ label, value }: { label: string; value: string }) {
  return <CopyField label={label} value={value} />;
}
