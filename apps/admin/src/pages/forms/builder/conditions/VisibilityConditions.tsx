import { useState, type ComponentProps } from "react";
import Button, { ButtonVariant } from "../../../../ui/Button";
import {
  SharedVisibilityNotice,
  useVisibilityGroupMember,
} from "../inspector/VisibilityGroupContext";
import { ExpandableEditor } from "../kit/ExpandableEditor";
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

  const removeAll = () => {
    onChange({ visibleIfFormula: undefined });
    expression.clear();
    setClears((count) => count + 1);
  };

  return (
    <ExpandableEditor
      title="Edit conditions"
      render={() => (
        <div className="flex flex-col gap-4">
          <ConditionalVisibility key={clears} {...props} />
          {conditional && (
            <Button
              variant={ButtonVariant.GhostDanger}
              size="small"
              onClick={removeAll}
            >
              Remove all conditions
            </Button>
          )}
        </div>
      )}
    />
  );
}

/**
 * An element's Conditions in the sidebar: its group's shared visibility while
 * it belongs to one, or else its own rules.
 */
export function ElementConditions(
  props: ComponentProps<typeof ConditionalVisibility>,
) {
  const groupMember = useVisibilityGroupMember(props.field.id);
  if (groupMember) {
    return <SharedVisibilityNotice {...groupMember} />;
  }
  return <VisibilityConditions {...props} />;
}
