import { JsonScopeKind } from "../../../../lib/formJson";
import { formatCount } from "../../../../lib/formatNumber";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { CheckboxField } from "../../../../ui/templates/Form";
import { Fact, FactList } from "../../../../ui/templates/Record";
import { PaneHeader } from "../../../../ui/templates/Workspace";
import { useBuilder } from "../BuilderContext";
import { InspectorGroup } from "../kit/InspectorGroup";
import FormSlugEditor from "../save/FormSlugEditor";

/** The inspector with the form itself selected: its slug, its settings, its JSON and its size. */
export function FormScopeInspector() {
  const {
    schema,
    setJsonScope,
    updateSchema,
    props: { formId, taskFlow },
  } = useBuilder();
  const elements = schema.pages.reduce(
    (count, page) => count + page.fields.length,
    0,
  );
  return (
    <>
      <PaneHeader title="Form" />
      <div className="flex flex-col gap-5 px-card py-4">
        <InspectorGroup>
          {formId !== undefined && (
            <div className="flex flex-col gap-1.5">
              <p className="font-medium">Slug</p>
              <FormSlugEditor formId={formId} />
            </div>
          )}
          {taskFlow && (
            <CheckboxField
              label="Show the step outline on the task card"
              help="Turn it off for long tasks."
              checked={schema.taskOutline !== false}
              onChange={(event) =>
                updateSchema({
                  ...schema,
                  taskOutline: event.target.checked ? undefined : false,
                })
              }
            />
          )}
          <FactList>
            <Fact label="Pages">{formatCount(schema.pages.length)}</Fact>
            <Fact label="Elements">{formatCount(elements)}</Fact>
          </FactList>
          <Button
            variant={ButtonVariant.Default}
            onClick={() => setJsonScope({ kind: JsonScopeKind.Form })}
          >
            Edit form JSON…
          </Button>
          <p className="text-caption text-fg-muted">
            Select an element on the canvas or in the outline to edit it.
          </p>
        </InspectorGroup>
      </div>
    </>
  );
}
