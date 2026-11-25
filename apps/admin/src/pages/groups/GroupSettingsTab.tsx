import type {
  CommunityDto,
  CreateCommunityDto,
} from "@alliance/shared/client/types.gen";
import { isEqual } from "es-toolkit";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useUpdateCommunityAdmin } from "../../lib/useCommunitiesAdmin";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import { useRefusalToast } from "../../lib/useRefusalToast";
import {
  FormSection,
  SaveBar,
  SaveState,
  useFocusFirstInvalid,
} from "../../ui/templates/Form";
import { PageBody } from "../../ui/templates/Page";
import { useToast } from "../../ui/ToastProvider";
import {
  GroupSettingsFields,
  validateGroupSettings,
  type GroupSettingsErrors,
} from "./GroupSettingsFields";

const settingsOf = (group: CommunityDto): CreateCommunityDto => ({
  name: group.name,
  description: group.description,
  public: group.public,
  maxCapacity: group.maxCapacity,
  allowMemberInvites: group.allowMemberInvites,
  allowStaffAssignments: group.allowStaffAssignments,
});

export function GroupSettingsTab({ group }: { group: CommunityDto }) {
  const { success } = useToast();
  const refusalToast = useRefusalToast();
  // A refetch reseeds the form only while it is untouched, so it brings in
  // newer settings without overwriting unsaved edits.
  const [seeded, setSeeded] = useState(() => ({
    id: group.id,
    settings: settingsOf(group),
  }));
  const [values, setValues] = useState(seeded.settings);
  const [errors, setErrors] = useState<GroupSettingsErrors>({});
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const [outcome, setOutcome] = useState<
    { saved: true } | { saved: false; reason: string } | null
  >(null);
  const dirty = !isEqual(values, seeded.settings);
  useLeaveGuard(dirty);

  const seed = (next: CommunityDto) => {
    const settings = settingsOf(next);
    setSeeded({ id: next.id, settings });
    setValues(settings);
    setErrors({});
  };
  if (
    group.id !== seeded.id ||
    (!isEqual(settingsOf(group), seeded.settings) && !dirty)
  ) {
    seed(group);
  }

  const update = useUpdateCommunityAdmin({
    onSuccess: (updated) => {
      seed(updated);
      setOutcome({ saved: true });
      success("Group updated", updated.name);
    },
    onError: (error) => {
      const fallback = "Unable to update group. Please try again.";
      setOutcome({
        saved: false,
        reason: adminRefusalMessage(error, fallback),
      });
      refusalToast(error, fallback);
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    // Staff may cap a group below its size to stop automated placement;
    // consensual placements already take groups past their capacity.
    const validated = validateGroupSettings(values, null);
    if (!validated.ok) {
      setErrors(validated.error);
      focusFirstInvalid();
      return;
    }
    setOutcome(null);
    update.mutate({ communityId: group.id, body: validated.value });
  };

  const state = update.isPending
    ? SaveState.Saving
    : outcome?.saved === false
      ? SaveState.Failed
      : dirty
        ? SaveState.Dirty
        : outcome?.saved
          ? SaveState.Saved
          : SaveState.Clean;

  return (
    <PageBody width="form">
      <form ref={formRef} onSubmit={submit} noValidate>
        <FormSection
          title="Details"
          description="Members see the name and description. The rest decides who can add members."
          footer={
            <SaveBar
              state={state}
              error={outcome?.saved === false ? outcome.reason : null}
              onDiscard={() => {
                setValues(seeded.settings);
                setErrors({});
                setOutcome(null);
              }}
            />
          }
        >
          <GroupSettingsFields
            values={values}
            errors={errors}
            onChange={(next) => {
              setValues(next);
              setErrors({});
              setOutcome(null);
            }}
          />
        </FormSection>
      </form>
    </PageBody>
  );
}
