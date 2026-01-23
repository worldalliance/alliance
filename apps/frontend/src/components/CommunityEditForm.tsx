import {
  CommunityDto,
  CreateCommunityDto,
  userDeleteCommunity,
  userUpdateCommunity,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useCallback, useState } from "react";

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

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const response = await userUpdateCommunity({
      path: { communityId: initialValue.id },
      body: formValues,
    });
    if (response.data) {
      setFormValues(response.data);
      onSuccess();
    } else {
      setError("Failed to update community");
    }
  }, [formValues, onSuccess, initialValue.id]);

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
    <div className="flex flex-col gap-y-2">
      <label className="text-black text-sm font-semibold" htmlFor="name">
        Name
      </label>
      <input
        value={formValues.name}
        onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
        className="border border-zinc-300 rounded px-3 py-2 w-full"
      />
      <label className="text-black text-sm font-semibold mt-3" htmlFor="name">
        Description
      </label>
      <textarea
        value={formValues.description}
        onChange={(e) =>
          setFormValues({ ...formValues, description: e.target.value })
        }
        className="border border-zinc-300 rounded px-3 py-2 w-full bg-white"
      />
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
          <Button onClick={onCancel} className="mt-1" color={ButtonColor.Grey}>
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
  );
};

export default CommunityEditForm;
