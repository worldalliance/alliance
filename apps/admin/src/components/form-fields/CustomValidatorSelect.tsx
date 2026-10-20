import {
  CustomValidatorType,
  CustomValidatorTypeDto,
} from "@alliance/shared/client";
import { useTagsAdmin } from "@alliance/shared/lib/useTagsAdmin";
import { cn } from "@alliance/shared/styles/util";
import { useMemo, type ChangeEvent } from "react";
import { CustomExpressionEditor } from "./CustomExpressionEditor";
import { useCustomValidators } from "./useCustomValidators";

type CustomValidatorSelectProps = {
  type?: CustomValidatorType;
  idArgument: string | null;
  expression: string | null;
  onChange: (params: {
    validatorType: CustomValidatorType | undefined;
    idArgument: string | null;
    expression: string | null;
  }) => void;
  className?: string;
  label?: string;
  filter?: (validator: CustomValidatorTypeDto) => boolean;
};

export function CustomValidatorSelect({
  type,
  idArgument,
  expression,
  onChange,
  className = "",
  label = "Custom validator",
  filter,
}: CustomValidatorSelectProps) {
  const { validators, loading, error } = useCustomValidators();
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

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value;
    if (!nextValue) {
      onChange({ validatorType: undefined, idArgument, expression });
      return;
    }
    onChange({
      validatorType: nextValue as CustomValidatorType,
      idArgument,
      expression,
    });
  };

  const hasValidators = availableValidators.length > 0;
  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.name.localeCompare(b.name)),
    [tags],
  );

  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <select
          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          value={type ?? ""}
          onChange={handleChange}
          disabled={loading || (!hasValidators && !type)}
        >
          <option value="">None</option>
          {availableValidators.map((validator) => (
            <option key={validator.id} value={validator.id}>
              {validator.name}
            </option>
          ))}
        </select>
        {!!validators.find((validator) => validator.id === type)?.withIdField &&
          (isMemberTag ? (
            <select
              value={idArgument ?? ""}
              onChange={(e) =>
                onChange({
                  validatorType: type,
                  idArgument: e.target.value === "" ? null : e.target.value,
                  expression,
                })
              }
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white w-32"
              disabled={tagsLoading}
            >
              <option value="">
                {tagsLoading ? "Loading..." : "Select a tag"}
              </option>
              {sortedTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={idArgument ?? ""}
              onChange={(e) =>
                onChange({
                  validatorType: type,
                  idArgument: e.target.value === "" ? null : e.target.value,
                  expression,
                })
              }
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white w-24"
            />
          ))}
      </div>
      {type === "CustomExpression" && (
        <CustomExpressionEditor
          expression={expression}
          onExpressionChange={(nextExpression) =>
            onChange({
              validatorType: type,
              idArgument,
              expression: nextExpression,
            })
          }
        />
      )}
      {loading && (
        <p className="text-[11px] text-gray-500">Loading validators…</p>
      )}
      {error && !loading && <p className="text-[11px] text-red-500">{error}</p>}
      {!loading && !hasValidators && !error && (
        <p className="text-[11px] text-gray-500">No custom validators found.</p>
      )}
    </div>
  );
}
