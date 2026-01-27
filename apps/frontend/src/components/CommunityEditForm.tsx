import {
  CommunityDto,
  CreateCommunityDto,
  userDeleteCommunity,
  userUpdateCommunity,
} from "@alliance/shared/client";
import {
  editGroupGroupAssignmentExplanation,
  editGroupPublicGroupExplanation,
} from "@alliance/shared/lib/copy";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useCallback, useMemo, useState } from "react";

export interface CommunityEditFormProps {
  initialValue: CommunityDto;
  onCancel: () => void;
  onSuccess: () => void;
  canDelete: boolean;
  onDelete: () => void;
}

const CommunityEditForm = ({
  initialValue,
  onCancel,
  onSuccess,
  canDelete,
  onDelete,
}: CommunityEditFormProps) => {
  const [formValues, setFormValues] =
    useState<CreateCommunityDto>(initialValue);
  const [allowStaffAssignments, setAllowStaffAssignments] = useState(
    initialValue.maxCapacity !== null
  );

  const [error, setError] = useState<string | null>(null);

  const requiresMaxCapacity = useMemo(
    () => formValues.public || allowStaffAssignments,
    [formValues.public, allowStaffAssignments]
  );

  const handleSubmit = useCallback(async () => {
    const normalizedMaxCapacity =
      allowStaffAssignments || formValues.public
        ? formValues.maxCapacity
        : null;
    if (requiresMaxCapacity) {
      if (!normalizedMaxCapacity || normalizedMaxCapacity <= 0) {
        setError("Capacity is required");
        return;
      }
    }

    const response = await userUpdateCommunity({
      path: { communityId: initialValue.id },
      body: {
        ...formValues,
        maxCapacity: normalizedMaxCapacity,
      },
    });
    if (response.data) {
      setFormValues(response.data);
      onSuccess();
    } else {
      setError("Failed to update community");
    }
  }, [
    allowStaffAssignments,
    formValues,
    initialValue.id,
    onSuccess,
    requiresMaxCapacity,
  ]);

  const handleDelete = useCallback(async () => {
    const response = await userDeleteCommunity({
      path: { communityId: initialValue.id },
    });
    if (response.data) {
      onDelete();
    } else {
      setError("Failed to delete community");
    }
  }, [onDelete, initialValue.id]);

  return (
    <>
      <Card style={CardStyle.Grey}>
        <div className="flex flex-col gap-y-2">
          <label className="text-black text-sm font-semibold" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            value={formValues.name}
            onChange={(e) =>
              setFormValues({ ...formValues, name: e.target.value })
            }
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
          <div className="flex flex-row justify-between">
            <div>
              {canDelete && (
                <Button
                  onClick={handleDelete}
                  className="mt-1"
                  color={ButtonColor.Red}
                >
                  Delete
                </Button>
              )}
            </div>

            <div className="flex gap-x-1">
              <Button
                onClick={onCancel}
                className="mt-1"
                color={ButtonColor.Grey}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="mt-1"
                color={ButtonColor.Black}
              >
                Save
              </Button>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
      </Card>
      <div className="flex flex-col gap-y-1 text-sm text-zinc-600 mt-3 mx-2">
        <p>* {editGroupPublicGroupExplanation}</p>
        <p>** {editGroupGroupAssignmentExplanation}</p>
      </div>
    </>
  );
};

export default CommunityEditForm;
