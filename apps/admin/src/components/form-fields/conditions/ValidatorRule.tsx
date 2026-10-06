import type { Condition } from "@alliance/common/forms/visible-if-formula";
import { CustomValidatorSelect } from "../CommonControls";
import {
  isDraftValidatorId,
  useCustomValidatorDrafts,
} from "../customValidatorDrafts";
import { RetryButton } from "./RetryButton";
import { INPUT_CLASS } from "./styles";
import { useSavedValidator } from "./useSavedValidator";

type ValidatorCondition = Extract<Condition, { kind: "validator" }>;

export function ValidatorRule({
  condition,
  removable,
  onChange,
  onRemove,
}: {
  condition: ValidatorCondition;
  removable: boolean;
  onChange: (condition: ValidatorCondition) => void;
  onRemove: () => void;
}) {
  const { drafts, setDraft, createDraftId } = useCustomValidatorDrafts();
  const { validatorId } = condition;
  const isDraft = isDraftValidatorId(validatorId);
  const saved = useSavedValidator(isDraft ? null : validatorId);
  const config = isDraft ? drafts[validatorId] : saved.data;

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
          allowNone={removable}
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
