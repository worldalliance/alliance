import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
} from "@alliance/common/community";
import { errorMessage } from "@alliance/common/errorMessage";
import {
  CommunityDto,
  CreateCommunityDto,
  communityCreateCommunity,
} from "@alliance/shared/client";
import { GROUP_MAX_CAPACITY_DEFAULT } from "@alliance/shared/lib/constants";
import { groupSettings } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { sharp_allowed_mime_types } from "@alliance/sharedweb/lib/config";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import CharacterLimitNotice from "@alliance/sharedweb/ui/CharacterLimitNotice";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import ImageEditor from "./ImageEditor";

export type CommunityCreateFormProps = {
  name?: string;
  includePhotoEditor?: boolean;
  createButtonTextOverride?: string;
  createDisabled?: boolean;
  fullWidthButtons?: boolean;
  hideSubmitButton?: boolean;
  submitRef?: RefObject<(() => Promise<void>) | null>;
  onCancel?: () => void;
  /** Awaited, so the submit state covers any follow-up work the caller does. */
  onSuccess: (community: CommunityDto) => void | Promise<void>;
};

const CommunityCreateForm = ({
  name,
  includePhotoEditor = true,
  createButtonTextOverride,
  createDisabled,
  fullWidthButtons,
  hideSubmitButton = false,
  submitRef,
  onCancel,
  onSuccess,
}: CommunityCreateFormProps) => {
  const initialFormValues = useMemo<CreateCommunityDto>(() => {
    const firstName = name?.split(" ")[0];
    return {
      name: firstName ? `${firstName}'s Group` : "",
      description: firstName
        ? `Reminder and discussion group for ${firstName}'s friends`
        : "",
      public: false,
      maxCapacity: GROUP_MAX_CAPACITY_DEFAULT,
      allowMemberInvites: true,
      allowStaffAssignments: true,
    };
  }, [name]);

  const [formValues, setFormValues] =
    useState<CreateCommunityDto>(initialFormValues);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const useMaxCapacity =
    formValues.public ||
    formValues.allowMemberInvites ||
    formValues.allowStaffAssignments;

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!formValues.name.trim()) {
      setError("Name is required");
      return;
    }
    let normalizedMaxCapacity: number | null = null;
    if (useMaxCapacity) {
      if (!formValues.maxCapacity || formValues.maxCapacity <= 0) {
        setError("Capacity is required");
        return;
      }
      normalizedMaxCapacity = formValues.maxCapacity;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await communityCreateCommunity({
        body: {
          ...formValues,
          photo: photoUrl ?? undefined,
          maxCapacity: normalizedMaxCapacity,
        },
      });
      if (response.data) {
        await onSuccess(response.data);
      } else {
        setError(
          errorMessage({
            error: response.error,
            fallback: "Failed to create community",
          }),
        );
      }
    } catch (err) {
      console.error("Failed to create community:", err);
      setError("Failed to create community");
    } finally {
      setIsSubmitting(false);
    }
  }, [useMaxCapacity, formValues, photoUrl, onSuccess]);

  useEffect(() => {
    if (!submitRef) {
      return;
    }
    submitRef.current = handleSubmit;
    return () => {
      submitRef.current = null;
    };
  }, [handleSubmit, submitRef]);

  const isPhotoUploadPending = isSubmitting && photoUrl !== null;

  return (
    <div className="flex flex-col gap-y-2">
      {includePhotoEditor && (
        <div className="mb-4">
          <ImageEditor
            initialImageUrl={photoUrl}
            onChange={setPhotoUrl}
            allowedMimeTypes={sharp_allowed_mime_types}
            isUploading={isPhotoUploadPending}
          />
        </div>
      )}
      <label className="text-black text-sm font-semibold" htmlFor="name">
        Name
      </label>
      <input
        id="name"
        value={formValues.name}
        maxLength={COMMUNITY_NAME_MAX_LENGTH}
        placeholder="Enter group name"
        onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
        className="border border-zinc-300 rounded px-3 py-2 w-full"
      />
      <CharacterLimitNotice
        value={formValues.name}
        max={COMMUNITY_NAME_MAX_LENGTH}
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
        maxLength={COMMUNITY_DESCRIPTION_MAX_LENGTH}
        value={formValues.description}
        onChange={(e) =>
          setFormValues({ ...formValues, description: e.target.value })
        }
        className="border border-zinc-300 rounded px-3 py-2 w-full bg-white"
      />
      <CharacterLimitNotice
        value={formValues.description}
        max={COMMUNITY_DESCRIPTION_MAX_LENGTH}
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
                setFormValues({
                  ...formValues,
                  public: checked,
                  allowMemberInvites: true,
                  allowStaffAssignments: true,
                });
              }}
              className="mt-1"
            />
            <div>
              <p className="text-base font-medium">
                {groupSettings.public.name}
              </p>
              <p className="text-sm text-zinc-500 font-normal">
                {groupSettings.public.explanation}
              </p>
            </div>
          </label>
          <label
            className="flex items-start gap-x-2 text-black text-sm font-semibold"
            htmlFor="allowMemberInvites"
          >
            <input
              id="allowMemberInvites"
              type="checkbox"
              checked={formValues.allowMemberInvites}
              onChange={(e) => {
                setFormValues({
                  ...formValues,
                  allowMemberInvites: e.target.checked,
                });
              }}
              disabled={formValues.public}
              className="mt-1"
            />
            <div>
              <p className="text-base font-medium">
                {groupSettings.allowMemberInvites.name}
              </p>
              <p className="text-sm text-zinc-500 font-normal">
                {groupSettings.allowMemberInvites.explanation}
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
              checked={formValues.allowStaffAssignments}
              onChange={(e) =>
                setFormValues({
                  ...formValues,
                  allowStaffAssignments: e.target.checked,
                })
              }
              disabled={formValues.public}
              className="mt-1"
            />
            <div>
              <p className="text-base font-medium">
                {groupSettings.allowStaffAssignments.name}
              </p>
              <p className="text-sm text-zinc-500 font-normal">
                {groupSettings.allowStaffAssignments.explanation}
              </p>
            </div>
          </label>
        </div>
        {useMaxCapacity && (
          <div className="mt-4">
            <label className="text-black font-medium" htmlFor="maxCapacity">
              <p className="text-base font-medium">
                {groupSettings.maxCapacity.name}
              </p>
              <p className="text-sm text-zinc-500 font-normal">
                {groupSettings.maxCapacity.explanation}
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
      {!hideSubmitButton && (
        <div className="flex flex-row justify-end">
          <div
            className={cn("flex gap-x-1 mt-1", fullWidthButtons && "w-full")}
          >
            {onCancel && (
              <Button
                onClick={onCancel}
                color={ButtonColor.Grey}
                className="flex-1"
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              color={ButtonColor.Black}
              disabled={
                isSubmitting || createDisabled || !formValues.name.trim()
              }
              className="flex-1"
            >
              {isSubmitting
                ? "Creating..."
                : (createButtonTextOverride ?? "Create")}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default CommunityCreateForm;
