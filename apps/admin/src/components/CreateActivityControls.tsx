import { ActionActivityType } from "@alliance/shared/client";
import { useCallback, useState } from "react";

const ACTIVITY_TYPE_OPTIONS = Object.entries({
  user_completed: "Completed",
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
      }) as { value: ActionActivityType; label: string },
  );

export interface CreateActivityControlsProps {
  create: (type: ActionActivityType) => Promise<unknown>;
}

const CreateActivityControls = ({ create }: CreateActivityControlsProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = useCallback(
    async (type: ActionActivityType) => {
      if (isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      try {
        await create(type);
      } catch (err) {
        console.error("Failed to create activity", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [create, isSubmitting],
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
