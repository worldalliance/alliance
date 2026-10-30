import { memberConditions } from "@alliance/common/forms/form-conditions";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import Card from "@alliance/sharedweb/ui/Card";
import { ChevronRight } from "lucide-react";
import { formPreviewPath } from "../../lib/formEditorLink";
import { useVisibilityProfilesAdmin } from "../../lib/useVisibilityProfilesAdmin";
import { VisibilityProfilePicker } from "../VisibilityProfilePicker";
import type { LaunchAction } from "./useSuiteLaunchData";

const VariantCount = ({
  schema,
  memberIds,
}: {
  schema: FormSchema;
  memberIds: number[];
}) => {
  const { data: profiles } = useVisibilityProfilesAdmin({
    schema,
    userIds: memberIds,
  });
  return (
    profiles && (
      <span className="ml-2 text-xs text-zinc-500">
        {withCount(profiles.length, "variant")}
      </span>
    )
  );
};

const TaskFormPreviews = ({ actions }: { actions: LaunchAction[] }) => {
  const varying = actions.flatMap(({ action, taskFormSchema, memberIds }) =>
    action.taskFormId != null &&
    taskFormSchema &&
    memberIds &&
    memberIds.length > 0 &&
    memberConditions(taskFormSchema).length > 0
      ? [
          {
            action,
            formId: action.taskFormId,
            schema: taskFormSchema,
            memberIds,
          },
        ]
      : [],
  );
  if (varying.length === 0) return null;
  return (
    <Card className="flex flex-col gap-4">
      <h3 className="font-semibold">Task forms by member</h3>
      <p className="text-xs text-zinc-500">
        These task forms show members different pages or questions depending on
        who they are. Click a group to open the task form previewed as one of
        its members.
      </p>
      <ul className="text-sm">
        {varying.map(({ action, formId, schema, memberIds }) => (
          <li key={action.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded px-1 py-1.5 hover:bg-zinc-100 [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  className="size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-90"
                  aria-hidden
                />
                {action.name}
                <VariantCount schema={schema} memberIds={memberIds} />
              </summary>
              <div className="my-3 ml-4 border-l-2 border-zinc-200 pl-3">
                <VisibilityProfilePicker
                  schema={schema}
                  userIds={memberIds}
                  selectedUserId={null}
                  onSelect={(userId) =>
                    window.open(
                      formPreviewPath(formId, userId),
                      "_blank",
                      "noopener",
                    )
                  }
                />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default TaskFormPreviews;
