import { Input } from "../../ui/Input";
import { Field } from "../../ui/templates/Form";
import type { CustomLinkErrors, CustomLinkValues } from "./customLinkRules";

export function CustomLinkFields({
  values,
  errors,
  onChange,
  destinationHelp,
  row = false,
  readOnly = false,
}: {
  values: CustomLinkValues;
  errors: CustomLinkErrors;
  onChange: (values: CustomLinkValues) => void;
  destinationHelp: string;
  /** Side by side, for the form above the list. */
  row?: boolean;
  readOnly?: boolean;
}) {
  return (
    <>
      <Field
        label="Label"
        error={errors.label}
        className={row ? "w-56" : undefined}
      >
        {(control) => (
          <Input
            {...control}
            readOnly={readOnly}
            value={values.label}
            maxLength={200}
            placeholder="100k flyer"
            onChange={(event) =>
              onChange({ ...values, label: event.target.value })
            }
          />
        )}
      </Field>
      <Field
        label="Path"
        error={errors.slug}
        className={row ? "w-44" : undefined}
      >
        {(control) => (
          <Input
            {...control}
            readOnly={readOnly}
            value={values.slug}
            maxLength={65}
            placeholder="/100k"
            onChange={(event) =>
              onChange({ ...values, slug: event.target.value })
            }
          />
        )}
      </Field>
      <Field
        label="Destination"
        help={destinationHelp}
        error={errors.destination}
        className={row ? "min-w-64 flex-1" : undefined}
      >
        {(control) => (
          <Input
            {...control}
            readOnly={readOnly}
            value={values.destination}
            maxLength={2048}
            placeholder="https://… or /site-path"
            onChange={(event) =>
              onChange({ ...values, destination: event.target.value })
            }
          />
        )}
      </Field>
    </>
  );
}
