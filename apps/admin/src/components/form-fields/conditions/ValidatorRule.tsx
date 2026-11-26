import type { Condition } from "@alliance/common/forms/visible-if-formula";
import { Select } from "../../../ui/Select";
import { Field } from "../../../ui/templates/Form";
import { CustomValidatorSelect } from "../CustomValidatorSelect";
import { useCustomValidatorDrafts } from "../customValidatorDrafts";
import { useValidatorConfig } from "../useValidatorConfig";
import { LoadFailure } from "./RetryButton";

type ValidatorCondition = Extract<Condition, { kind: "validator" }>;

export function ValidatorRule({
  condition,
  onChange,
  onRemove,
}: {
  condition: ValidatorCondition;
  onChange: (condition: ValidatorCondition) => void;
  onRemove: () => void;
}) {
  const { setDraft, createDraftId } = useCustomValidatorDrafts();
  const { validatorId } = condition;
  const { config, isDraft, saved } = useValidatorConfig(validatorId);

  return (
    <>
      {config || isDraft ? (
        <CustomValidatorSelect
          type={config?.type}
          idArgument={config?.idArgument ?? null}
          onChange={({ validatorType, idArgument }) => {
            if (!validatorType) {
              onRemove();
              return;
            }
            const draftId = isDraft ? validatorId : createDraftId();
            setDraft(draftId, { type: validatorType, idArgument });
            onChange({ ...condition, validatorId: draftId });
          }}
          filter={(validator) => validator.usableForVisibility}
          label="Validator"
        />
      ) : saved.isError ? (
        <LoadFailure onRetry={() => void saved.refetch()}>
          Couldn't load validator {validatorId}.
        </LoadFailure>
      ) : (
        <p className="text-caption text-fg-muted">Loading validator details…</p>
      )}
      <Field label="Result">
        {(control) => (
          <Select
            {...control}
            value={String(condition.resultEquals ?? true)}
            onChange={(event) =>
              onChange({
                ...condition,
                resultEquals: event.target.value === "true",
              })
            }
          >
            <option value="true">passes</option>
            <option value="false">fails</option>
          </Select>
        )}
      </Field>
    </>
  );
}
