import type { Ref } from "react";
import { Input } from "../../ui/Input";
import { Field } from "../../ui/templates/Form";
import { Textarea } from "../../ui/Textarea";
import type { TagFormErrors, TagFormValues } from "./tagRules";

export function TagFields({
  values,
  errors,
  onChange,
  nameRef,
}: {
  values: TagFormValues;
  errors: TagFormErrors;
  onChange: (values: TagFormValues) => void;
  nameRef?: Ref<HTMLInputElement>;
}) {
  return (
    <>
      <Field label="Name" error={errors.name}>
        {(control) => (
          <Input
            {...control}
            ref={nameRef}
            value={values.name}
            onChange={(event) =>
              onChange({ ...values, name: event.target.value })
            }
          />
        )}
      </Field>
      <Field label="Public display name" mark="optional">
        {(control) => (
          <Input
            {...control}
            value={values.publicDisplayName}
            onChange={(event) =>
              onChange({ ...values, publicDisplayName: event.target.value })
            }
          />
        )}
      </Field>
      <Field label="Description" error={errors.description}>
        {(control) => (
          <Textarea
            {...control}
            value={values.description}
            onChange={(event) =>
              onChange({ ...values, description: event.target.value })
            }
          />
        )}
      </Field>
    </>
  );
}
