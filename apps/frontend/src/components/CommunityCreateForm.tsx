import {
  CommunityDto,
  CreateCommunityDto,
  userCreateCommunity,
} from "@alliance/shared/client";
import { GROUP_MAX_CAPACITY_DEFAULT } from "@alliance/shared/lib/constants";
import {
  editGroupGroupAssignmentExplanation,
  editGroupPublicGroupExplanation,
} from "@alliance/shared/lib/copy";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import ImageEditor from "./ImageEditor";
import { sharp_allowed_mime_types } from "@alliance/sharedweb/lib/config";
import { useCallback, useMemo, useState } from "react";

export type CommunityCreateFormProps = {
  name?: string;
  onCancel: () => void;
  onSuccess: (community: CommunityDto) => void;
};

const CommunityCreateForm = (props: CommunityCreateFormProps) => {
  const initialFormValues = useMemo<CreateCommunityDto>(() => {
    const firstName = props.name?.split(" ")[0];
    return {
      name: firstName ? `${firstName}'s Group` : "",
      description: firstName
        ? `Reminder and discussion group for ${firstName}'s friends`
        : "",
      public: false,
      maxCapacity: GROUP_MAX_CAPACITY_DEFAULT,
    };
  }, [props.name]);

  const [formValues, setFormValues] =
    useState<CreateCommunityDto>(initialFormValues);
  const [allowStaffAssignments, setAllowStaffAssignments] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const requiresMaxCapacity = useMemo(
    () => formValues.public || allowStaffAssignments,
    [formValues.public, allowStaffAssignments]
  );

  const handleSubmit = useCallback(async () => {
    if (!formValues.name.trim()) {
      setError("Name is required");
      return;
    }
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

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await userCreateCommunity({
        body: {
          ...formValues,
          photo: photoUrl ?? undefined,
          maxCapacity: normalizedMaxCapacity,
        },
      });
      if (response.data) {
        props.onSuccess(response.data);
      } else {
        setError(`Failed to create community`);
      }
    } catch (err) {
      console.error("Failed to create community:", err);
      setError("Failed to create community");
    } finally {
      setIsSubmitting(false);
    }
  }, [allowStaffAssignments, formValues, photoUrl, props, requiresMaxCapacity]);

  const isPhotoUploadPending = isSubmitting && photoUrl !== null;

  return (
    <div className="flex flex-col gap-y-2">
      <div className="mb-4">
        <ImageEditor
          initialImageUrl={photoUrl}
          onChange={setPhotoUrl}
          allowedMimeTypes={sharp_allowed_mime_types}
          isUploading={isPhotoUploadPending}
        />
      </div>
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
        placeholder={"Enter group description"}
        value={formValues.description}
        onChange={(e) =>
          setFormValues({ ...formValues, description: e.target.value })
        }
        className="border border-zinc-300 rounded px-3 py-2 w-full bg-white"
      />
      <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex flex-col gap-y-3">
          <label
            className="flex items-start gap-x-2 text-black text-sm font-semibold"
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
              className="mt-1"
            />
            <div>
              <p className="text-base font-medium">Public group</p>
              <p className="text-sm text-zinc-500 font-normal">
                {editGroupPublicGroupExplanation}
              </p>
            </div>
          </label>
          <label
            className="flex items-start gap-x-2 text-black text-sm font-semibold"
            htmlFor="allowAssignments"
          >
            <input
              id="allowAssignments"
              type="checkbox"
              checked={allowStaffAssignments}
              onChange={(e) => setAllowStaffAssignments(e.target.checked)}
              disabled={formValues.public}
              className="mt-1"
            />
            <div>
              <p className="text-base font-medium">Accept member assignments</p>
              <p className="text-sm text-zinc-500 font-normal">
                {editGroupGroupAssignmentExplanation}
              </p>
            </div>
          </label>
        </div>
        {requiresMaxCapacity && (
          <div className="mt-4">
            <label className="text-black font-medium" htmlFor="maxCapacity">
              <p className="text-base font-medium">Member capacity</p>
              <p className="text-sm text-zinc-500 font-normal">
                The maximum number of members that can join this group.
              </p>
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
      <div className="flex flex-row justify-end">
        <div className="flex gap-x-1 mt-1">
          <Button
            onClick={props.onCancel}
            color={ButtonColor.Grey}
            className="!h-9"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            color={ButtonColor.Black}
            className="!h-9"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default CommunityCreateForm;
