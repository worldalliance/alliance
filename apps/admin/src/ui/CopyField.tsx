import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { useState } from "react";
import Button, { ButtonVariant } from "./Button";
import InlineError from "./InlineError";
import { Input } from "./Input";
import { Field } from "./templates/Form";
import { useToast } from "./ToastProvider";

/**
 * A value to copy, such as a link or a key: read-only, selected on focus, with
 * a "Copy {label}" button. A failed copy says so under it, since the
 * clipboard can refuse.
 */
export function CopyField({
  label,
  value,
}: {
  /** "Link"; the button reads "Copy link". */
  label: string;
  value: string;
}) {
  const { success } = useToast();
  const [failedValue, setFailedValue] = useState<string | null>(null);
  const failed = failedValue === value;
  const thing = label.toLowerCase();
  const copy = async () => {
    const copied = await copyToClipboard(value);
    setFailedValue(copied ? null : value);
    if (copied) success(`Copied ${thing}`);
  };
  return (
    <Field label={label}>
      {(control) => (
        <>
          <div className="flex gap-2">
            <Input
              {...control}
              readOnly
              value={value}
              className="font-mono text-xs"
              onFocus={(event) => event.target.select()}
            />
            <Button
              variant={ButtonVariant.Default}
              className="shrink-0"
              onClick={() => void copy()}
            >
              Copy {thing}
            </Button>
          </div>
          <InlineError
            message={
              failed
                ? `Couldn't copy the ${thing}. Select it and copy it yourself.`
                : null
            }
          />
        </>
      )}
    </Field>
  );
}
