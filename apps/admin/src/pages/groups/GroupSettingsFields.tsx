import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
  isMaxCapacityRequired,
  validateCommunitySettings,
} from "@alliance/common/community";
import { R, type Result } from "@alliance/common/result";
import type { CreateCommunityDto } from "@alliance/shared/client/types.gen";
import { groupSettings } from "@alliance/shared/lib/copy";
import CharacterLimitNotice from "../../ui/CharacterLimitNotice";
import { Input } from "../../ui/Input";
import { CheckboxField, Field } from "../../ui/templates/Form";
import { Textarea } from "../../ui/Textarea";

export type GroupSettingsErrors = { name?: string; maxCapacity?: string };

/**
 * The checks a group form runs before saving, with the failure placed on the
 * field that fixes it. `memberCount` is the floor for the capacity; null
 * allows any.
 */
export function validateGroupSettings(
  settings: CreateCommunityDto,
  memberCount: number | null,
): Result<CreateCommunityDto, GroupSettingsErrors> {
  const validated = validateCommunitySettings({ settings, memberCount });
  if (!validated.ok) {
    // The name is checked first. Of the later checks only the capacity's can
    // fail here: ticking Public forces on the two permissions its rule needs.
    return R.failure(
      settings.name.trim()
        ? { maxCapacity: validated.error }
        : { name: validated.error },
    );
  }
  return R.success({
    ...settings,
    name: validated.value.name,
    description: settings.description.trim(),
    maxCapacity: validated.value.maxCapacity,
  });
}

const PUBLIC_FORCES = "Always on for a group anyone can join.";

/** The fields of a group, for the New group dialog and a group's Settings tab. */
export function GroupSettingsFields({
  values,
  errors,
  onChange,
}: {
  values: CreateCommunityDto;
  errors: GroupSettingsErrors;
  onChange: (values: CreateCommunityDto) => void;
}) {
  const capacityUsed = isMaxCapacityRequired(values);
  return (
    <>
      <Field label="Name" error={errors.name}>
        {(control) => (
          <>
            <Input
              {...control}
              value={values.name}
              maxLength={COMMUNITY_NAME_MAX_LENGTH}
              onChange={(event) =>
                onChange({ ...values, name: event.target.value })
              }
            />
            <CharacterLimitNotice
              value={values.name}
              max={COMMUNITY_NAME_MAX_LENGTH}
            />
          </>
        )}
      </Field>
      <Field label="Description" mark="optional">
        {(control) => (
          <>
            <Textarea
              {...control}
              value={values.description}
              maxLength={COMMUNITY_DESCRIPTION_MAX_LENGTH}
              onChange={(event) =>
                onChange({ ...values, description: event.target.value })
              }
            />
            <CharacterLimitNotice
              value={values.description}
              max={COMMUNITY_DESCRIPTION_MAX_LENGTH}
            />
          </>
        )}
      </Field>
      <CheckboxField
        label={groupSettings.public.name}
        help={groupSettings.public.explanation}
        checked={values.public}
        onChange={(event) =>
          onChange({
            ...values,
            public: event.target.checked,
            allowMemberInvites: true,
            allowStaffAssignments: true,
          })
        }
      />
      <CheckboxField
        label={groupSettings.allowMemberInvites.name}
        help={
          values.public
            ? PUBLIC_FORCES
            : groupSettings.allowMemberInvites.explanation
        }
        checked={values.allowMemberInvites}
        disabled={values.public}
        onChange={(event) =>
          onChange({ ...values, allowMemberInvites: event.target.checked })
        }
      />
      <CheckboxField
        label={groupSettings.allowStaffAssignments.name}
        help={
          values.public
            ? PUBLIC_FORCES
            : groupSettings.allowStaffAssignments.explanation
        }
        checked={values.allowStaffAssignments}
        disabled={values.public}
        onChange={(event) =>
          onChange({ ...values, allowStaffAssignments: event.target.checked })
        }
      />
      {/* Always rendered, so ticking a box above never moves the form's foot. */}
      <Field
        label={groupSettings.maxCapacity.name}
        help={
          capacityUsed
            ? groupSettings.maxCapacity.explanation
            : "Not used: nobody but a leader can add members to this group."
        }
        error={errors.maxCapacity}
      >
        {(control) => (
          <Input
            {...control}
            type="number"
            min={1}
            className="w-32"
            disabled={!capacityUsed}
            value={values.maxCapacity ?? ""}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onChange({
                ...values,
                maxCapacity:
                  event.target.value === "" || Number.isNaN(parsed)
                    ? null
                    : parsed,
              });
            }}
          />
        )}
      </Field>
    </>
  );
}
