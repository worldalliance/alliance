import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type {
  AnyField,
  OutputViewSchema,
} from "@alliance/common/forms/form-schema";
import { taskFlow } from "@alliance/shared/lib/copy";
import Badge from "../../../../ui/Badge";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { cn } from "../../../../ui/cn";
import { Input } from "../../../../ui/Input";
import { Select } from "../../../../ui/Select";
import { Field } from "../../../../ui/templates/Form";
import { PaneHeader } from "../../../../ui/templates/Workspace";
import { InspectorGroup } from "../kit/InspectorGroup";
import { HEADER_TRUNCATES } from "../paneHeader";
import { VIEW_LAYOUTS } from "./outputSelection";

const HEADER = cn(HEADER_TRUNCATES, "z-20 bg-canvas");

/** What the inspector says when "All output views" is selected. */
export function AllViewsInspector({
  subtitle,
  onSubtitle,
  outputFields,
}: {
  subtitle: string | undefined;
  onSubtitle: (subtitle: string | undefined) => void;
  outputFields: AnyField[];
}) {
  return (
    <>
      <PaneHeader title="All output views" className={HEADER} />
      <div className="flex flex-col gap-5 px-card py-4">
        <InspectorGroup>
          <Field
            label="Completion screen subtitle"
            help={
              <>
                Shown under &ldquo;{taskFlow.complete}&rdquo;. Left empty, it
                reads &ldquo;{taskFlow.completeUpdate}&rdquo;
              </>
            }
          >
            {(control) => (
              <Input
                {...control}
                type="text"
                value={subtitle ?? ""}
                onChange={(event) =>
                  onSubtitle(event.target.value || undefined)
                }
              />
            )}
          </Field>
        </InspectorGroup>
        <InspectorGroup title="Current output fields">
          {outputFields.length > 0 ? (
            <ul
              aria-label="Current output fields"
              className="flex flex-wrap gap-1.5"
            >
              {outputFields.map((field) => (
                <li key={field.id}>
                  <Badge>{elementInternalDescriptor(field)}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-muted">
              No output fields selected yet. Mark questions as output fields on
              the Form tab.
            </p>
          )}
        </InspectorGroup>
      </div>
    </>
  );
}

/** One view's title and layout, and removing it. */
export function ViewInspector({
  view,
  onUpdate,
  onRemove,
  isLast,
}: {
  view: OutputViewSchema;
  onUpdate: (updates: Partial<OutputViewSchema>) => void;
  onRemove: () => void;
  isLast: boolean;
}) {
  return (
    <>
      <PaneHeader title={view.title || "Untitled view"} className={HEADER} />
      <div className="flex flex-col gap-5 px-card py-4">
        <Field label="View title">
          {(control) => (
            <Input
              {...control}
              type="text"
              value={view.title || ""}
              onChange={(event) => onUpdate({ title: event.target.value })}
              placeholder="Output view title"
            />
          )}
        </Field>
        <Field label="Layout">
          {(control) => (
            <Select
              {...control}
              value={view.type || "default"}
              onChange={(event) => {
                const layout = VIEW_LAYOUTS.find(
                  (candidate) => candidate.value === event.target.value,
                );
                if (layout) onUpdate({ type: layout.value });
              }}
            >
              {VIEW_LAYOUTS.map((layout) => (
                <option key={layout.value} value={layout.value}>
                  {layout.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <InspectorGroup>
          <div className="flex flex-col items-start gap-1.5">
            <Button
              variant={ButtonVariant.DangerOutline}
              disabled={isLast}
              onClick={onRemove}
            >
              Remove view
            </Button>
            {isLast && (
              <p className="text-caption text-fg-muted">
                The last output view can't be removed.
              </p>
            )}
          </div>
        </InspectorGroup>
      </div>
    </>
  );
}
