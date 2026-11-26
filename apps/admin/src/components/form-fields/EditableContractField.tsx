import type { ContractField } from "@alliance/common/forms/form-schema";
import { useCurrentContract } from "@alliance/shared/lib/useCurrentContract";
import { useEffect, useMemo } from "react";
import { useContractsAdmin } from "../../lib/useContractsAdmin";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Field } from "../../ui/templates/Form";
import { RequiredToggle } from "./CommonControls";
import { useDerivedWrite } from "./derivedWrite";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableContractField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<ContractField>) {
  const { data: contracts = [] } = useContractsAdmin();

  const { data: currentContract } = useCurrentContract();
  const derivedWrite = useDerivedWrite();

  useEffect(() => {
    if (
      !currentContract ||
      (field.contractId !== null && field.contractId !== undefined)
    ) {
      return;
    }
    derivedWrite(() => onUpdate({ contractId: currentContract.id }));
  }, [currentContract, derivedWrite, field.contractId, onUpdate]);

  const contractOptions = useMemo(
    () =>
      contracts.map((c) => ({
        id: c.id,
        name: c.name?.trim() || `Contract #${c.id}`,
      })),
    [contracts],
  );

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === field.contractId) ?? null,
    [contracts, field.contractId],
  );

  // Sync contract markdown into parent state so Preview mode has access to it
  useEffect(() => {
    if (!selectedContract) {
      return;
    }
    if (selectedContract.id === field.contract?.id) {
      return;
    }
    derivedWrite(() =>
      onUpdate({
        contract: {
          id: selectedContract.id,
          markdown: selectedContract.markdown,
        },
      }),
    );
  }, [derivedWrite, selectedContract, field.contract?.id, onUpdate]);

  // Merge selected contract onto field so RenderField (existing preview) can show markdown + sign toggle
  const fieldWithContract = useMemo(
    () => (selectedContract ? { ...field, contract: selectedContract } : field),
    [field, selectedContract],
  );

  return (
    <FieldWrapper
      field={fieldWithContract}
      onUpdate={onUpdate}
      previousFields={previousFields}
      laterFields={laterFields}
    >
      <InspectorGroup>
        <FieldLabelEditor
          label="Question"
          value={field.label}
          onChange={(value) => onUpdate({ label: value })}
        />
        <RequiredToggle
          checked={field.required}
          onChange={(checked) => onUpdate({ required: checked })}
        />
      </InspectorGroup>

      <InspectorGroup title="Contract">
        <Field label="Contract">
          {(control) => (
            <Select
              {...control}
              value={field.contractId ?? currentContract?.id ?? ""}
              onChange={(event) =>
                onUpdate({ contractId: Number(event.target.value) })
              }
            >
              {contractOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Sign question">
          {(control) => (
            <Input
              {...control}
              value={field.signQuestion ?? ""}
              placeholder="Sign the contract?"
              onChange={(event) =>
                onUpdate({ signQuestion: event.target.value })
              }
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Yes label">
            {(control) => (
              <Input
                {...control}
                value={field.yesLabel ?? ""}
                placeholder="Yes"
                onChange={(event) => onUpdate({ yesLabel: event.target.value })}
              />
            )}
          </Field>
          <Field label="No label">
            {(control) => (
              <Input
                {...control}
                value={field.noLabel ?? ""}
                placeholder="No"
                onChange={(event) => onUpdate({ noLabel: event.target.value })}
              />
            )}
          </Field>
        </div>
      </InspectorGroup>
    </FieldWrapper>
  );
}
