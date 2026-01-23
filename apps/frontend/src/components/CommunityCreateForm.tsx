import {
  CommunityDto,
  CreateCommunityDto,
  userCreateCommunity,
} from "@alliance/shared/client";
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
      };
    }
    const firstName = name.split(" ")[0];
    return {
      name: `${firstName}'s Group`,
      description: `Reminder and discussion group for ${firstName}'s friends`,
    };
  }, [name]);

  const [formValues, setFormValues] =
    useState<CreateCommunityDto>(defaultValues);

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const response = await userCreateCommunity({ body: formValues });
    if (response.data) {
      onSuccess(response.data);
    } else {
      setError("Failed to create community");
    }
  }, [formValues, onSuccess]);

  return (
    <div className="flex flex-col gap-y-2">
      <label className="text-black text-sm font-semibold" htmlFor="name">
        Name
      </label>
      <input
        value={formValues.name}
        placeholder="Enter group name"
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
    </div>
  );
};

export default CommunityCreateForm;
