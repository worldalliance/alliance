import type { ChoiceField } from "@alliance/common/forms/formula-options";
import type { OptionsFormula } from "@alliance/common/forms/variables";
import { cn } from "@alliance/shared/styles/util";
import { isEqual } from "es-toolkit";
import { List, Sigma } from "lucide-react";
import { useId, useState } from "react";
import ConfirmDialog from "../ConfirmDialog";

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

export function OptionsSourcePicker({
  field,
  onUpdate,
}: {
  field: ChoiceField;
  onUpdate: (updates: Partial<ChoiceField>) => void;
}) {
  const [confirming, setConfirming] = useState<OptionsSource | null>(null);
  const captionId = useId();
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
    { title: string; message: string }
  > = {
    [OptionsSource.Fixed]: {
      title: "Go back to a fixed list?",
      message: "This removes the formula and its inputs.",
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
    },
  };
  const choose = (source: OptionsSource) =>
    loses[source] ? setConfirming(source) : onUpdate(switchTo[source]);

  const button = (params: {
    selected: boolean;
    label: string;
    icon: typeof List;
    onClick: () => void;
  }) => (
    <button
      type="button"
      aria-pressed={params.selected}
      onClick={params.selected ? undefined : params.onClick}
      className={cn(
        "flex items-center gap-1 rounded px-2 py-1 text-xs",
        params.selected
          ? "bg-white font-medium text-gray-900 shadow-sm"
          : "text-gray-500 hover:text-gray-800",
      )}
    >
      <params.icon size={12} />
      {params.label}
    </button>
  );

  return (
    <div className="space-y-1">
      <p id={captionId} className="text-xs font-medium text-gray-700">
        Options from
      </p>
      <div
        role="group"
        aria-labelledby={captionId}
        className="inline-flex gap-0.5 rounded bg-gray-100 p-0.5"
      >
        {button({
          selected: !usesFormula,
          label: "Fixed list",
          icon: List,
          onClick: () => choose(OptionsSource.Fixed),
        })}
        {button({
          selected: usesFormula,
          label: "Formula",
          icon: Sigma,
          onClick: () => choose(OptionsSource.Formula),
        })}
      </div>
      {confirming !== null && (
        <ConfirmDialog
          isOpen
          {...confirmations[confirming]}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            setConfirming(null);
            onUpdate(switchTo[confirming]);
          }}
        />
      )}
    </div>
  );
}
