import type { ChoiceOption } from "@alliance/common/forms/formula-options";
import type { Result } from "@alliance/common/result";
import { FormulaResult } from "./formulaResult";

export type Preview =
  | { result: FormulaResult.Text; value: Result<string, string> }
  | { result: FormulaResult.Options; value: Result<ChoiceOption[], string> };

export function ResultPreview({
  preview,
  type,
}: {
  preview: Preview;
  type: string;
}) {
  const { result } = preview;
  switch (result) {
    case FormulaResult.Text:
      return (
        <p className="text-xs text-gray-500">
          Result:{" "}
          <span className="font-mono">
            {(preview.value.ok && preview.value.value) || "—"}
          </span>{" "}
          <span className="text-gray-400">&middot; {type}</span>
        </p>
      );
    case FormulaResult.Options: {
      const options = preview.value.ok ? preview.value.value : [];
      return (
        <div className="space-y-1 text-xs text-gray-500">
          <p>
            {options.length === 0
              ? "No options with these sample answers."
              : "Options with these sample answers, repeated values merged:"}
          </p>
          {options.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {options.map((option) => (
                <li
                  key={option.value}
                  className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5"
                >
                  {option.label}{" "}
                  <span className="font-mono text-gray-400">
                    {option.value}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    default:
      throw new Error(`unknown formula result: ${result satisfies never}`);
  }
}
