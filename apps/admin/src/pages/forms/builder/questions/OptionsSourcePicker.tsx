import type { ChoiceField } from "@alliance/common/forms/formula-options";
import type { OptionsFormula } from "@alliance/common/forms/variables";
import { isEqual } from "es-toolkit";
import { useState } from "react";
import ConfirmDialog from "../../../../ui/ConfirmDialog";
import { Select } from "../../../../ui/Select";
import { Field } from "../../../../ui/templates/Form";

enum OptionsSource {
  Fixed = "fixed",
  Formula = "formula",
}

const EMPTY_FORMULA: OptionsFormula = { inputs: {}, formula: "[]" };

const switchTo: Record<OptionsSource, Partial<ChoiceField>> = {
  [OptionsSource.Fixed]: {
    optionsFormula: undefined,
    options: [{ label: "Option 1", value: "option1" }],
  },
  [OptionsSource.Formula]: {
    options: [],
    categories: undefined,
    defaultValue: undefined,
    optionsFormula: EMPTY_FORMULA,
  },
};

const SOURCE_LABEL: Record<OptionsSource, string> = {
  [OptionsSource.Fixed]: "Fixed list",
  [OptionsSource.Formula]: "Formula",
};

export function OptionsSourcePicker({
  field,
  onUpdate,
}: {
  field: ChoiceField;
  onUpdate: (updates: Partial<ChoiceField>) => void;
}) {
  const [confirming, setConfirming] = useState<OptionsSource | null>(null);
  const usesFormula = field.optionsFormula !== undefined;
  const fixedCount = field.options.length;
  const hasCategories = (field.categories?.length ?? 0) > 0;
  const loses: Record<OptionsSource, boolean> = {
    [OptionsSource.Fixed]:
      usesFormula && !isEqual(field.optionsFormula, EMPTY_FORMULA),
    [OptionsSource.Formula]: fixedCount > 0 || hasCategories,
  };
  const confirmations: Record<
    OptionsSource,
    { title: string; message: string; confirmLabel: string }
  > = {
    [OptionsSource.Fixed]: {
      title: "Go back to a fixed list?",
      message: "This removes the formula and its inputs.",
      confirmLabel: "Use a fixed list",
    },
    [OptionsSource.Formula]: {
      title: "Compute the options with a formula?",
      message: `This removes ${new Intl.ListFormat("en").format([
        ...(fixedCount > 0
          ? [
              `the ${fixedCount === 1 ? "fixed option" : `${fixedCount} fixed options`}`,
            ]
          : []),
        ...(hasCategories ? ["the option categories"] : []),
        ...(field.defaultValue != null ? ["the default"] : []),
      ])}.`,
      confirmLabel: "Use a formula",
    },
  };
  const choose = (source: OptionsSource) =>
    loses[source] ? setConfirming(source) : onUpdate(switchTo[source]);

  return (
    <>
      <Field label="Options from">
        {(control) => (
          <Select
            {...control}
            value={usesFormula ? OptionsSource.Formula : OptionsSource.Fixed}
            onChange={(event) => {
              const source = Object.values(OptionsSource).find(
                (value) => value === event.target.value,
              );
              if (!source) {
                throw new Error(`unknown source: ${event.target.value}`);
              }
              choose(source);
            }}
          >
            {Object.values(OptionsSource).map((source) => (
              <option key={source} value={source}>
                {SOURCE_LABEL[source]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {confirming !== null && (
        <ConfirmDialog
          open
          destructive
          {...confirmations[confirming]}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            setConfirming(null);
            onUpdate(switchTo[confirming]);
          }}
        />
      )}
    </>
  );
}
