import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
  isMaxCapacityRequired,
  validateCommunitySettings,
} from "@alliance/common/community";
import type {
  CommunityDto,
  CreateCommunityDto,
  UpdateCommunityDto,
} from "@alliance/shared/client/types.gen";
import { groupSettings } from "@alliance/shared/lib/copy";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CharacterLimitNotice from "@alliance/sharedweb/ui/CharacterLimitNotice";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { isEqual } from "es-toolkit";
import React, { useCallback, useState } from "react";
import { useUpdateCommunityAdmin } from "../../lib/useCommunitiesAdmin";
import type { GroupErrorReporting } from "./groupErrors";

const detailsOf = (community: CommunityDto): CreateCommunityDto => ({
  name: community.name,
  description: community.description,
  public: community.public,
  maxCapacity: community.maxCapacity,
  allowMemberInvites: community.allowMemberInvites,
  allowStaffAssignments: community.allowStaffAssignments,
});

type GroupSettingsFormProps = GroupErrorReporting & {
  community: CommunityDto;
};

const GroupSettingsForm: React.FC<GroupSettingsFormProps> = ({
  community,
  setError,
  reportError,
}) => {
  // A refetch reseeds the form only while it is untouched, so it brings in
  // newer details without overwriting unsaved edits.
  const [seeded, setSeeded] = useState(() => ({
    id: community.id,
    details: detailsOf(community),
  }));
  const [formValues, setFormValues] = useState(seeded.details);
  const { success } = useToast();
  const requiresMaxCapacity = isMaxCapacityRequired(formValues);

  const seed = useCallback((group: CommunityDto) => {
    const details = detailsOf(group);
    setSeeded({ id: group.id, details });
    setFormValues(details);
  }, []);
  if (
    community.id !== seeded.id ||
    (!isEqual(detailsOf(community), seeded.details) &&
      isEqual(formValues, seeded.details))
  ) {
    seed(community);
  }

  const { mutate: updateCommunity, isPending: savingDetails } =
    useUpdateCommunityAdmin({
      onSuccess: (updated) => {
        seed(updated);
        success("Group updated", updated.name);
      },
      onError: (err) =>
        reportError(err, "Unable to update group. Please try again."),
    });

  const handleUpdateDetails = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const validated = validateCommunitySettings({
        settings: formValues,
        // Staff may cap a group below its size to stop automated placement;
        // consensual placements already take groups past their capacity.
        memberCount: null,
      });
      if (!validated.ok) {
        setError(validated.error);
        return;
      }
      const payload: UpdateCommunityDto = {
        name: validated.value.name,
        description: formValues.description.trim(),
        public: formValues.public,
        maxCapacity: validated.value.maxCapacity,
        allowMemberInvites: formValues.allowMemberInvites,
        allowStaffAssignments: formValues.allowStaffAssignments,
      };
      setError(null);
      updateCommunity({ communityId: community.id, body: payload });
    },
    [community.id, formValues, updateCommunity, setError],
  );

  return (
    <Card style={CardStyle.White}>
      <form className="flex flex-col gap-4" onSubmit={handleUpdateDetails}>
        <div className="flex flex-col gap-1">
          <label
            className="text-sm font-medium text-zinc-700"
            htmlFor="group-name"
          >
            Name
          </label>
          <input
            id="group-name"
            type="text"
            className="border border-zinc-300 rounded px-3 py-2 text-sm"
            value={formValues.name}
            maxLength={COMMUNITY_NAME_MAX_LENGTH}
            onChange={(event) =>
              setFormValues((prev) => ({
                ...prev,
                name: event.target.value,
              }))
            }
          />
          <CharacterLimitNotice
            value={formValues.name}
            max={COMMUNITY_NAME_MAX_LENGTH}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            className="text-sm font-medium text-zinc-700"
            htmlFor="group-description"
          >
            Description
          </label>
          <textarea
            id="group-description"
            className="border border-zinc-300 rounded px-3 py-2 text-sm min-h-[80px]"
            value={formValues.description}
            maxLength={COMMUNITY_DESCRIPTION_MAX_LENGTH}
            onChange={(event) =>
              setFormValues((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
          />
          <CharacterLimitNotice
            value={formValues.description}
            max={COMMUNITY_DESCRIPTION_MAX_LENGTH}
          />
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex flex-col gap-y-3">
            <label className="flex items-start gap-x-2 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={formValues.public}
                onChange={(event) => {
                  setFormValues((prev) => ({
                    ...prev,
                    public: event.target.checked,
                    allowStaffAssignments: true,
                    allowMemberInvites: true,
                  }));
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
            <label className="flex items-start gap-x-2 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={formValues.allowMemberInvites}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    allowMemberInvites: event.target.checked,
                  }))
                }
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
            <label className="flex items-start gap-x-2 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={formValues.allowStaffAssignments}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    allowStaffAssignments: event.target.checked,
                  }))
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
          {requiresMaxCapacity && (
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
                className="mt-2 border border-zinc-300 rounded px-3 py-2 text-sm w-full bg-white"
                value={formValues.maxCapacity ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  const parsed = Number(value);
                  setFormValues((prev) => ({
                    ...prev,
                    maxCapacity:
                      value === "" || Number.isNaN(parsed) ? null : parsed,
                  }));
                }}
              />
            </div>
          )}
        </div>
        <Button
          type="submit"
          color={ButtonColor.Blue}
          className="self-start"
          disabled={savingDetails}
        >
          {savingDetails ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
};

export default GroupSettingsForm;
