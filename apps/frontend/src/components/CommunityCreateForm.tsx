import {
  CommunityDto,
  CreateCommunityDto,
  userCreateCommunity,
} from "@alliance/shared/client";
import {
  editGroupGroupAssignmentExplanation,
  editGroupPublicGroupExplanation,
} from "@alliance/shared/lib/copy";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useCallback, useMemo, useState } from "react";

export interface CommunityCreateFormProps {
  name?: string;
  onCancel: () => void;
  onSuccess: (community: CommunityDto) => void;
}

const CommunityCreateForm = ({
  name,
  onCancel,
  onSuccess,
}: CommunityCreateFormProps) => {
  const defaultValues = useMemo<CreateCommunityDto>(() => {
    if (!name) {
      return {
        name: "",
        description: "",
        public: false,
        maxCapacity: null,
      };
    }
    const firstName = name.split(" ")[0];
    return {
      name: `${firstName}'s Group`,
      description: `Reminder and discussion group for ${firstName}'s friends`,
      public: false,
      maxCapacity: null,
    };
  }, [name]);

  const [formValues, setFormValues] =
    useState<CreateCommunityDto>(defaultValues);
  const [allowStaffAssignments, setAllowStaffAssignments] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const requiresMaxCapacity = useMemo(
    () => formValues.public || allowStaffAssignments,
    [formValues.public, allowStaffAssignments]
  );

  const handleSubmit = useCallback(async () => {
    const normalizedMaxCapacity =
      allowStaffAssignments || formValues.public ? formValues.maxCapacity : null;
    if (requiresMaxCapacity) {
      if (!normalizedMaxCapacity || normalizedMaxCapacity <= 0) {
        setError(
          "Max capacity is required when the community is public or allows staff assignment."
        );
        return;
      }
    }

    const response = await userCreateCommunity({
      body: {
        ...formValues,
        maxCapacity: normalizedMaxCapacity,
      },
    });
    if (response.data) {
      onSuccess(response.data);
    } else {
      setError("Failed to create community");
    }
  }, [allowStaffAssignments, formValues, onSuccess, requiresMaxCapacity]);

  return (
    <div className="flex flex-col gap-y-2">
      <label className="text-black text-sm font-semibold" htmlFor="name">
        Name
      </label>
      <input
        id="name"
        value={formValues.name}
        placeholder="Enter group name"
        onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
        className="border border-zinc-300 rounded px-3 py-2 w-full"
      />
      <label
        className="text-black text-sm font-semibold mt-3"
        htmlFor="description"
      >
        Description
      </label>
      <textarea
        id="description"
        value={formValues.description}
        onChange={(e) =>
          setFormValues({ ...formValues, description: e.target.value })
        }
        className="border border-zinc-300 rounded px-3 py-2 w-full bg-white"
      />
      <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex flex-col gap-y-3">
          <label
            className="flex items-center gap-x-2 text-black text-sm font-semibold"
            htmlFor="public"
          >
            <input
              id="public"
              type="checkbox"
              checked={formValues.public}
              onChange={(e) => {
                const checked = e.target.checked;
                setFormValues({ ...formValues, public: checked });
                if (checked) {
                  setAllowStaffAssignments(true);
                }
              }}
            />
            Public*
          </label>
          <label
            className="flex items-center gap-x-2 text-black text-sm font-semibold"
            htmlFor="allowAssignments"
          >
            <input
              id="allowAssignments"
              type="checkbox"
              checked={allowStaffAssignments}
              onChange={(e) => setAllowStaffAssignments(e.target.checked)}
              disabled={formValues.public}
            />
            Group assignment**
          </label>
        </div>
        {requiresMaxCapacity && (
          <div className="mt-4">
            <label
              className="text-black text-sm font-semibold"
              htmlFor="maxCapacity"
            >
              Group assignment capacity (required)
            </label>
            <input
              id="maxCapacity"
              type="number"
              min={1}
              value={formValues.maxCapacity ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                const parsed = Number(value);
                setFormValues({
                  ...formValues,
                  maxCapacity:
                    value === "" || Number.isNaN(parsed) ? null : parsed,
                });
              }}
              className="mt-2 border border-zinc-300 rounded px-3 py-2 w-full bg-white"
            />
          </div>
        )}
      </div>
      <div className="flex gap-x-1 justify-end">
        <Button onClick={onCancel} className="mt-1" color={ButtonColor.Grey}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          className="mt-1"
          color={ButtonColor.Black}
        >
          Create
        </Button>
      </div>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      <div className="flex flex-col gap-y-1 text-sm text-zinc-600 mt-3">
        <p>* {editGroupPublicGroupExplanation}</p>
        <p>** {editGroupGroupAssignmentExplanation}</p>
      </div>
    </div>
  );
};

export default CommunityCreateForm;
