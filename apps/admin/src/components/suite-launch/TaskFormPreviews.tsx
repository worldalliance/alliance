import { memberConditions } from "@alliance/common/forms/form-conditions";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import Card from "@alliance/sharedweb/ui/Card";
import { sumBy } from "es-toolkit";
import { useState } from "react";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import Disclosure from "../Disclosure";
import { MemberFormRenderer } from "../MemberFormRenderer";
import { VisibilityProfilePicker } from "../VisibilityProfilePicker";
import type { LaunchAction } from "./useSuiteLaunchData";

const TaskFormPreview = ({
  schema,
  memberIds,
}: {
  schema: FormSchema;
  memberIds: number[];
}) => {
  const { data: users = [] } = useUsersAdmin();
  const [userId, setUserId] = useState<number | null>(null);
  const user = users.find((candidate) => candidate.id === userId);
  return (
    <div className="my-3 ml-4 flex flex-col gap-4 border-l-2 border-zinc-200 pl-3">
      <VisibilityProfilePicker
        schema={schema}
        userIds={memberIds}
        selectedUserId={userId}
        onSelect={setUserId}
      />
      {user ? (
        <div className="max-w-3xl rounded-lg border border-zinc-200 p-4">
          <p className="mb-2 text-xs text-zinc-500">As {user.name} sees it</p>
          <MemberFormRenderer
            schema={schema}
            previewUserId={user.id}
            user={user}
          />
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          {userId === null
            ? "Pick a group to see the form as one of its members."
            : "Loading the member…"}
        </p>
      )}
    </div>
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
        who they are. Click one to preview it as each kind of member.
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
                </>
              }
            >
              <TaskFormPreview schema={schema} memberIds={memberIds} />
            </Disclosure>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default TaskFormPreviews;
