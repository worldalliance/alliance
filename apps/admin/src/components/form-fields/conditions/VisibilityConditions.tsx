import { useState, type ComponentProps } from "react";
import {
  JoinVisibilityButtons,
  SharedVisibilityNotice,
  useVisibilityGroupMember,
} from "../../VisibilityGroupContext";
import { ConditionalVisibility } from "./ConditionalVisibility";
import { useTypedExpression } from "./expressionBuffers";

/**
 * The settings sidebar's visibility editor, which shows whether or not the
 * element has rules, and can drop every rule along with any typed expression.
 */
export function VisibilityConditions(
  props: ComponentProps<typeof ConditionalVisibility>,
) {
  const { field, onChange } = props;
  const expression = useTypedExpression(field);
  // The editor stays in expression mode after a clear unless it remounts.
  const [clears, setClears] = useState(0);
  const conditional = field.visibleIfFormula !== undefined || expression.typed;

  return (
    <div className="space-y-3">
      <ConditionalVisibility key={clears} {...props} />
      {conditional && (
        <button
          type="button"
          onClick={() => {
            onChange({ visibleIfFormula: undefined });
            expression.clear();
            setClears((count) => count + 1);
          }}
          className="text-xs text-red-600 hover:text-red-700"
        >
          Remove all conditions
        </button>
      )}
    </div>
  );
}

/**
 * An element's Conditions in the sidebar: its group's shared visibility while
 * it belongs to one, or its own rules and the joins its neighbors offer.
 */
export function ElementConditions(
  props: ComponentProps<typeof ConditionalVisibility>,
) {
  const groupMember = useVisibilityGroupMember(props.field.id);
  if (groupMember) {
    return <SharedVisibilityNotice detach={groupMember.detach} />;
  }
  return (
    <>
      <div className="flex items-center gap-1 empty:hidden">
        <JoinVisibilityButtons elementId={props.field.id} />
      </div>
      <VisibilityConditions {...props} />
    </>
  );
}
