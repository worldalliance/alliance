import { memberConditions } from "@alliance/common/forms/form-conditions";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import Card from "@alliance/sharedweb/ui/Card";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import { useVisibilityProfilesAdmin } from "../../lib/useVisibilityProfilesAdmin";
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
    taskFormSchema &&
    memberIds &&
    memberIds.length > 0 &&
    memberConditions(taskFormSchema).length > 0
      ? [{ action, schema: taskFormSchema, memberIds }]
      : [],
  );
  if (varying.length === 0) return null;
  return (
    <Card className="flex flex-col gap-4">
      <h3 className="font-semibold">Task forms by member</h3>
      <p className="text-xs text-zinc-500">
        These task forms show members different pages or questions depending on
        who they are. Click one to preview it as each kind of member.
      </p>
      <ul className="text-sm">
        {varying.map(({ action, schema, memberIds }) => (
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
              <TaskFormPreview schema={schema} memberIds={memberIds} />
            </details>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default TaskFormPreviews;
