import type { Condition } from "@alliance/common/forms/visible-if-formula";
import { CustomValidatorSelect } from "../CommonControls";
import { useCustomValidatorDrafts } from "../customValidatorDrafts";
import { useValidatorConfig } from "../useValidatorConfig";
import { RetryButton } from "./RetryButton";
import { INPUT_CLASS } from "./styles";

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
    <div className="space-y-2">
      {config || isDraft ? (
        <CustomValidatorSelect
          type={config?.type}
          idArgument={config?.idArgument ?? null}
          expression={config?.expression ?? null}
          onChange={({ validatorType, idArgument, expression }) => {
            if (!validatorType) {
              onRemove();
              return;
            }
            const draftId = isDraft ? validatorId : createDraftId();
            setDraft(draftId, { type: validatorType, idArgument, expression });
            onChange({ ...condition, validatorId: draftId });
          }}
          filter={(validator) => validator.usableForVisibility}
          label="Visibility validator"
        />
      ) : saved.isError ? (
        <div className="flex items-center gap-2">
          <p className="text-[11px] text-red-600">
            Could not load validator {validatorId}.
          </p>
          <RetryButton onClick={() => void saved.refetch()} />
        </div>
      ) : (
        <p className="text-[11px] text-gray-400">Loading validator details…</p>
      )}
      <select
        aria-label="Validator result"
        className={INPUT_CLASS}
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
      </select>
    </div>
  );
}
