import type {
  CustomValidatorType,
  CustomValidatorTypeDto,
} from "@alliance/shared/client";
import { useMemo } from "react";
import { useCustomValidatorTypesAdmin } from "../../../../lib/useCustomValidatorTypesAdmin";
import { useTagsAdmin } from "../../../../lib/useTagsAdmin";
import { cn } from "../../../../ui/cn";
import { Input } from "../../../../ui/Input";
import { Select } from "../../../../ui/Select";
import { Field } from "../../../../ui/templates/Form";

type CustomValidatorSelectProps = {
  type?: CustomValidatorType;
  idArgument: string | null;
  onChange: (params: {
    validatorType: CustomValidatorType | undefined;
    idArgument: string | null;
  }) => void;
  className?: string;
  label?: string;
  filter?: (validator: CustomValidatorTypeDto) => boolean;
};

/** What a validator's id argument names (`server/src/tasks/customvalidator.service.ts`). */
const ID_ARGUMENT_LABEL: Record<CustomValidatorType, string | null> = {
  UploadedPhoto: null,
  SignedContract: null,
  AddedProfileDescription: null,
  RepliedToForumPost: "Forum post ID",
  RepliedToForumPostOrChild: "Forum post ID",
  HasPhoneNumber: null,
  IsPhoneNumberValid: null,
  MemberTag: "Tag",
  MemberCommunity: "Community ID",
  AnyCommunity: null,
};

export function CustomValidatorSelect({
  type,
  idArgument,
  onChange,
  className,
  label = "Custom validator",
  filter,
}: CustomValidatorSelectProps) {
  const { validators, loading, error } = useCustomValidatorTypesAdmin();
  const isMemberTag = type === "MemberTag";
  const { tags, isLoading: tagsLoading } = useTagsAdmin({
    enabled: isMemberTag,
  });
  const availableValidators = useMemo(() => {
    if (!filter) {
      return validators;
    }
    const filtered = validators.filter(filter);
    if (!type) {
      return filtered;
    }
    const selected = validators.find((validator) => validator.id === type);
    if (
      selected &&
      !filtered.some((validator) => validator.id === selected.id)
    ) {
      return [...filtered, selected];
    }
    return filtered;
  }, [validators, filter, type]);

  const handleChange = (value: string) => {
    onChange({
      validatorType: validators.find((validator) => validator.id === value)?.id,
      idArgument,
    });
  };
  const handleIdArgumentChange = (value: string) =>
    onChange({ validatorType: type, idArgument: value === "" ? null : value });

  const hasValidators = availableValidators.length > 0;
  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.name.localeCompare(b.name)),
    [tags],
  );
  const takesId = !!validators.find((validator) => validator.id === type)
    ?.withIdField;
  const idLabel = (type && ID_ARGUMENT_LABEL[type]) || "ID";

  const help = loading
    ? "Loading validators…"
    : !error && !hasValidators
      ? "No custom validators found."
      : undefined;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Field label={label} help={help} error={loading ? null : error}>
        {(control) => (
          <Select
            {...control}
            value={type ?? ""}
            onChange={(event) => handleChange(event.target.value)}
            disabled={loading || (!hasValidators && !type)}
          >
            <option value="">None</option>
            {availableValidators.map((validator) => (
              <option key={validator.id} value={validator.id}>
                {validator.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {takesId && (
        <Field label={idLabel}>
          {(control) =>
            isMemberTag ? (
              <Select
                {...control}
                value={idArgument ?? ""}
                onChange={(event) => handleIdArgumentChange(event.target.value)}
                disabled={tagsLoading}
              >
                <option value="">
                  {tagsLoading ? "Loading…" : "Select a tag"}
                </option>
                {sortedTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                {...control}
                value={idArgument ?? ""}
                onChange={(event) => handleIdArgumentChange(event.target.value)}
                className="font-mono"
              />
            )
          }
        </Field>
      )}
    </div>
  );
}
