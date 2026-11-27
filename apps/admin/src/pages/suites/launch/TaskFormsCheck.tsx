import { memberConditions } from "@alliance/common/forms/form-conditions";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { sumBy } from "es-toolkit";
import Disclosure from "../../../components/Disclosure";
import type { LaunchAction } from "../../../components/suite-launch/useSuiteLaunchData";
import { VisibilityProfilePicker } from "../../../components/VisibilityProfilePicker";
import { countOf } from "../../../lib/formatNumber";
import { formPreviewPath } from "../../../lib/formEditorLink";
import { useVisibilityProfilesAdmin } from "../../../lib/useVisibilityProfilesAdmin";
import { Panel } from "../../../ui/templates/Overview";

function VariantCount({
  schema,
  memberIds,
}: {
  schema: FormSchema;
  memberIds: number[];
}) {
  const { data: profiles, error } = useVisibilityProfilesAdmin({
    schema,
    userIds: memberIds,
  });
  if (error) {
    return (
      <span className="text-caption text-danger" title={error.message}>
        {"Couldn't group members"}
      </span>
    );
  }
  return (
    profiles && (
      <span className="text-caption text-fg-muted">
        {countOf(profiles.length, "member variant")}
      </span>
    )
  );
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

type VaryingForm = {
  action: LaunchAction["action"];
  formId: number;
  schema: FormSchema;
  memberIds: number[];
  label: string | null;
};

const varyingForms = ({
  action,
  taskFormSchema,
  variantForms,
  memberIds,
}: LaunchAction): VaryingForm[] => {
  if (!memberIds || memberIds.length === 0) return [];
  const forms = [
    ...(action.taskFormId != null && taskFormSchema
      ? [
          {
            formId: action.taskFormId,
            schema: taskFormSchema,
            label:
              variantForms.length > 0
                ? `task form, ${percent(1 - sumBy(variantForms, ({ share }) => share))}`
                : null,
          },
        ]
      : []),
    ...variantForms.map(({ formId, schema, name, share }) => ({
      formId,
      schema,
      label: `variant “${name}”, ${percent(share)}`,
    })),
  ];
  return forms
    .filter(({ schema }) => memberConditions(schema).length > 0)
    .map((form) => ({ ...form, action, memberIds }));
};

/** Task forms whose pages or questions depend on who the member is. */
export function TaskFormsCheck({ actions }: { actions: LaunchAction[] }) {
  const varying = actions.flatMap(varyingForms);
  if (varying.length === 0) return null;
  const hasVariants = varying.some(({ label }) => label !== null);
  return (
    <Panel title="Task forms by member">
      <div className="flex flex-col gap-3">
        <p className="text-fg-muted">
          These task forms show members different pages or questions depending
          on who they are. Open one to preview it as a member of each kind.
          {hasVariants &&
            " A task with variants gives each member its task form or one of its variants at random, in the shares shown."}
        </p>
        <ul className="-mx-1.5 flex flex-col">
          {varying.map(({ action, formId, schema, memberIds, label }) => (
            <li key={`${action.id}-${formId}`}>
              <Disclosure
                summary={
                  <>
                    {action.name}
                    {label && <span className="text-fg-muted">, {label}</span>}
                    <span className="ml-2">
                      <VariantCount schema={schema} memberIds={memberIds} />
                    </span>
                  </>
                }
              >
                <div className="my-3 ml-7">
                  <VisibilityProfilePicker
                    schema={schema}
                    userIds={memberIds}
                    hrefFor={(userId) => formPreviewPath({ formId, userId })}
                  />
                </div>
              </Disclosure>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
