import type { CreateExternalShareTargetDto } from "@alliance/shared/client/types.gen";
import { cn } from "../../ui/cn";
import { Input } from "../../ui/Input";
import { Field } from "../../ui/templates/Form";
import type { ShareTargetErrors } from "./shareTargetRules";

export function ShareTargetFields({
  values,
  errors,
  onChange,
  row = false,
  readOnly = false,
}: {
  values: CreateExternalShareTargetDto;
  errors: ShareTargetErrors;
  onChange: (values: CreateExternalShareTargetDto) => void;
  /** Side by side, for the form above the list. */
  row?: boolean;
  readOnly?: boolean;
}) {
  return (
    <>
      <Field
        label="Name"
        help="For staff only."
        error={errors.name}
        className={row ? "w-56" : undefined}
      >
        {(control) => (
          <Input
            {...control}
            readOnly={readOnly}
            value={values.name}
            placeholder="Partner X signup"
            onChange={(event) =>
              onChange({ ...values, name: event.target.value })
            }
          />
        )}
      </Field>
      <Field
        label="URL"
        error={errors.url}
        className={row ? "min-w-64 flex-1" : undefined}
      >
        {(control) => (
          <Input
            {...control}
            readOnly={readOnly}
            value={values.url}
            placeholder="https://example.com/route"
            className="font-mono text-xs"
            onChange={(event) =>
              onChange({ ...values, url: event.target.value })
            }
          />
        )}
      </Field>
      <Field
        label="Parameter name"
        error={errors.paramName}
        className={cn(row && "w-44")}
      >
        {(control) => (
          <Input
            {...control}
            readOnly={readOnly}
            value={values.paramName}
            placeholder="code"
            className="font-mono text-xs"
            onChange={(event) =>
              onChange({ ...values, paramName: event.target.value })
            }
          />
        )}
      </Field>
    </>
  );
}
