import { memberConditions } from "@alliance/common/forms/form-conditions";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import Card from "@alliance/sharedweb/ui/Card";
import { sumBy } from "es-toolkit";
import { formPreviewPath } from "../../lib/formEditorLink";
import { useVisibilityProfilesAdmin } from "../../lib/useVisibilityProfilesAdmin";
import Disclosure from "../Disclosure";
import { VisibilityProfilePicker } from "../VisibilityProfilePicker";
import type { LaunchAction } from "./useSuiteLaunchData";

const VariantCount = ({
  schema,
  memberIds,
}: {
  schema: FormSchema;
  memberIds: number[];
}) => {
  const { data: profiles, error } = useVisibilityProfilesAdmin({
    schema,
    userIds: memberIds,
  });
  if (error) {
    return (
      <span className="ml-2 text-xs text-red-600" title={error.message}>
        {"Couldn't group members"}
      </span>
    );
  }
  return (
    profiles && (
      <span className="ml-2 text-xs text-zinc-500">
        {withCount(profiles.length, "member variant")}
      </span>
    )
  );
};

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

const TaskFormPreviews = ({ actions }: { actions: LaunchAction[] }) => {
  const varying = actions.flatMap(varyingForms);
  const hasVariants = varying.some(({ label }) => label !== null);
  if (varying.length === 0) return null;
  return (
    <Card className="flex flex-col gap-4">
      <h3 className="font-semibold">Task forms by member</h3>
      <p className="text-xs text-zinc-500">
        These task forms show members different pages or questions depending on
        who they are. Click a group to open the task form previewed as one of
        its members.
        {hasVariants &&
          " An action with variants gives each member its task form or one of its variants at random, in the shares shown."}
      </p>
      <ul className="text-sm">
        {varying.map(({ action, formId, schema, memberIds, label }) => (
          <li key={`${action.id}-${formId}`}>
            <Disclosure
              summary={
                <>
                  {action.name}
                  {label && <span className="text-zinc-500">, {label}</span>}
                  <VariantCount schema={schema} memberIds={memberIds} />
                </>
              }
            >
              <div className="my-3 ml-4 border-l-2 border-zinc-200 pl-3">
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
    </Card>
  );
};

export default TaskFormPreviews;
