import type { ContractField } from "@alliance/common/forms/form-schema";
import { contractAllAdmin, contractGetCurrent } from "@alliance/shared/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { RequiredToggle } from "./CommonControls";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableContractField({
  field,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseFieldProps<ContractField>) {
  const { data: contracts = [] } = useQuery({
    queryKey: ["contractAllAdmin"],
    queryFn: async () => {
      const res = await contractAllAdmin();
      return res.data ?? [];
    },
  });

  const { data: currentContract } = useQuery({
    queryKey: ["contractGetCurrent"],
    queryFn: () => contractGetCurrent().then((res) => res.data ?? null),
  });

  // Default to current contract when none selected (once per field)
  const hasDefaulted = useRef(false);
  useEffect(() => {
    if (
      hasDefaulted.current ||
      !currentContract ||
      (field.contractId !== null && field.contractId !== undefined)
    ) {
      return;
    }
    hasDefaulted.current = true;
    onUpdate({ contractId: currentContract.id });
  }, [currentContract, field.contractId, onUpdate]);

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
    onUpdate({
      contract: {
        id: selectedContract.id,
        markdown: selectedContract.markdown,
      },
    });
  }, [selectedContract, field.contract?.id, onUpdate]);

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
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
    >
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Contract
        </label>
        <select
          value={field.contractId ?? currentContract?.id ?? ""}
          onChange={(e) => onUpdate({ contractId: Number(e.target.value) })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {contractOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Sign question
        </label>
        <input
          type="text"
          value={field.signQuestion ?? ""}
          onChange={(e) => onUpdate({ signQuestion: e.target.value })}
          placeholder="Sign the contract?"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Yes option label
          </label>
          <input
            type="text"
            value={field.yesLabel ?? ""}
            onChange={(e) => onUpdate({ yesLabel: e.target.value })}
            placeholder="Yes"
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            No option label
          </label>
          <input
            type="text"
            value={field.noLabel ?? ""}
            onChange={(e) => onUpdate({ noLabel: e.target.value })}
            placeholder="No"
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <RequiredToggle
        checked={field.required}
        onChange={(checked) => onUpdate({ required: checked })}
      />
    </FieldWrapper>
  );
}
