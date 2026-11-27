import { useId, type ReactNode } from "react";
import { cn } from "../../../../ui/cn";
import { controlClass } from "../../../../ui/styles";
import { VariableTextField } from "../questions/VariableTextField";

/**
 * A labelled `VariableTextField` laid out like the guide's `Field`, which can't
 * wrap it: the field takes no `id`, so the label reaches it by `aria-label`.
 */
export function BlockTextField({
  label,
  ariaLabel = label,
  value,
  onChange,
  help,
  mark,
  multiline = false,
  rows,
  placeholder,
}: {
  label: string;
  /** Names the field apart from its neighbours, as in a list's rows. */
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  help?: ReactNode;
  mark?: "optional";
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const helpId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span aria-hidden="true" className="font-medium">
        {label}
        {mark && <span className="font-normal text-fg-muted"> ({mark})</span>}
      </span>
      <VariableTextField
        aria-label={ariaLabel}
        aria-describedby={help ? helpId : undefined}
        multiline={multiline}
        minRows={multiline ? (rows ?? 3) : undefined}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          controlClass,
          multiline ? "resize-none py-1.5" : "h-control",
        )}
      />
      {help && (
        <p id={helpId} className="text-caption text-fg-muted">
          {help}
        </p>
      )}
    </div>
  );
}
