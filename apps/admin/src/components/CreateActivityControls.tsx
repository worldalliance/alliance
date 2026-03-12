import {
  ActionActivityType,
  actionsCreateActivity,
} from "@alliance/shared/client";
import { useCallback, useState } from "react";

const ACTIVITY_TYPE_OPTIONS = Object.entries({
  user_joined: "Joined",
  user_completed: "Completed",
  user_declined: "Declined",
  user_wont_complete: "Won't complete",
  user_dismissed: null,
  user_submitted_follow_up_form: null,
} satisfies Record<ActionActivityType, string | null>)
  .filter(([, label]) => label !== null)
  .map(
    ([value, label]) =>
      ({
        value,
        label,
      } as { value: ActionActivityType; label: string })
  );

export interface CreateActivityControlsProps {
  actionId: number;
  userId: number;
  onCreated: () => void;
}

const CreateActivityControls = ({
  actionId,
  userId,
  onCreated,
}: CreateActivityControlsProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = useCallback(
    async (type: ActionActivityType) => {
      if (isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await actionsCreateActivity({
          body: {
            actionId,
            userId,
            type,
          },
        });

        if (response.error) {
          console.error("Failed to create activity", response.error);
          return;
        }

        onCreated();
      } catch (err) {
        console.error("Failed to create activity", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [actionId, isSubmitting, onCreated, userId]
  );

  return (
    <select
      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 cursor-pointer"
      value=""
      onChange={(e) => {
        const value = e.target.value as ActionActivityType;
        if (value) {
          void handleCreate(value);
        }
      }}
      disabled={isSubmitting}
    >
      <option value="">{isSubmitting ? "..." : "+ Activity"}</option>
      {ACTIVITY_TYPE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default CreateActivityControls;
