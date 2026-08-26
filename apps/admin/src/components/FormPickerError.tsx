import { FormFieldsStatus } from "@alliance/shared/lib/useFormSchema";
import { cn } from "@alliance/shared/styles/util";

/** The ways a form picker comes up empty with nothing to show for it. */
export enum FormPickerErrorReason {
  FormList = "formList",
  FormLoad = "formLoad",
  FormSchema = "formSchema",
}

const ERROR_TEXT: Record<FormPickerErrorReason, string> = {
  [FormPickerErrorReason.FormList]: "Could not load the list of forms.",
  [FormPickerErrorReason.FormLoad]:
    "Could not load that form. It may have been deleted.",
  [FormPickerErrorReason.FormSchema]:
    "That form loaded, but its questions could not be read.",
};

/** null while the fields are pending or ready — nothing to report yet. */
export function formFieldsErrorReason(
  status: FormFieldsStatus | undefined,
): FormPickerErrorReason | null {
  switch (status) {
    case FormFieldsStatus.LoadFailed:
      return FormPickerErrorReason.FormLoad;
    case FormFieldsStatus.SchemaUnreadable:
      return FormPickerErrorReason.FormSchema;
    case FormFieldsStatus.Pending:
    case FormFieldsStatus.Ready:
    case undefined:
      return null;
    default:
      throw new Error(`unknown form fields status: ${status satisfies never}`);
  }
}

export function FormPickerError({
  reason,
  className,
}: {
  reason: FormPickerErrorReason;
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-red-600", className)}>
      {ERROR_TEXT[reason]}
    </p>
  );
}
