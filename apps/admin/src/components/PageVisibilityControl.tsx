import { type AnyField, type Page } from "@alliance/common/forms/form-schema";
import { type VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { useState } from "react";
import { ConditionalVisibility } from "./form-fields/conditions/ConditionalVisibility";
import { useTypedExpression } from "./form-fields/conditions/expressionBuffers";

/** Key by page id: the toggle state belongs to one page. */
export function PageVisibilityControl({
  page,
  isFirstPage,
  previousFields,
  onChange,
}: {
  page: Page;
  isFirstPage: boolean;
  previousFields: AnyField[];
  onChange: (updates: { visibleIfFormula?: VisibleIfFormula }) => void;
}) {
  const hasConditions =
    Object.keys(page.visibleIfFormula?.conditions ?? {}).length > 0;
  const expression = useTypedExpression(page);
  const [opened, setOpened] = useState(hasConditions || expression.typed);
  if (hasConditions && !opened) {
    setOpened(true);
  }

  const handleToggle = (checked: boolean) => {
    setOpened(checked);
    if (!checked) {
      onChange({ visibleIfFormula: undefined });
      expression.clear();
    }
  };

  return (
    <div className="mt-3">
      <label className="flex cursor-pointer items-center text-xs text-gray-700">
        <input
          type="checkbox"
          className="mr-2"
          checked={opened}
          onChange={(event) => handleToggle(event.target.checked)}
        />
        Use conditional visibility for this page
      </label>
      {opened && (
        <div className="mt-2">
          {isFirstPage && (
            <p className="mb-2 text-xs text-amber-600">
              Conditions on the first page can only reference other forms or
              validators, since no fields have been answered yet.
            </p>
          )}
          <ConditionalVisibility
            field={page}
            previousFields={previousFields}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}
