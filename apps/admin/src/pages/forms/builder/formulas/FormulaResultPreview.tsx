import type { ChoiceOption } from "@alliance/common/forms/formula-options";
import type { Result } from "@alliance/common/result";
import { FormulaResult } from "./formulaResult";

export type Preview =
  | { result: FormulaResult.Text; value: Result<string, string> }
  | { result: FormulaResult.Options; value: Result<ChoiceOption[], string> };

/** What the formula gives with the sample answers above it: a well, so it reads apart from the inputs. */
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
        <div className="rounded-md bg-surface-2 px-3 py-2 text-fg-muted">
          <p>
            Result:{" "}
            <span className="font-mono text-xs text-fg">
              {(preview.value.ok && preview.value.value) || "—"}
            </span>{" "}
            <span>&middot; {type}</span>
          </p>
        </div>
      );
    case FormulaResult.Options: {
      const options = preview.value.ok ? preview.value.value : [];
      return (
        <div className="flex flex-col gap-2 rounded-md bg-surface-2 px-3 py-2 text-fg-muted">
          <p>
            {options.length === 0
              ? "No options with these sample answers."
              : "Options with these sample answers, repeated values merged:"}
          </p>
          {options.length > 0 && (
            <ul
              aria-label="Previewed options"
              className="flex flex-wrap gap-1.5"
            >
              {options.map((option) => (
                <li
                  key={option.value}
                  className="rounded-sm border border-line bg-surface px-1.5 py-0.5 text-caption text-fg"
                >
                  {option.category && (
                    <span className="text-fg-muted">{option.category}: </span>
                  )}
                  {option.label}{" "}
                  <span className="font-mono text-fg-muted">
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
