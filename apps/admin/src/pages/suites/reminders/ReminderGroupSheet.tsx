import type {
  ReminderAnchorCandidateDto,
  ReminderGroupDto,
} from "@alliance/shared/client";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  presetNames,
  type ReminderPreset,
  type ReminderPresetName,
  reminderPresets,
} from "../../../components/reminders/presets";
import { useLeaveGuard } from "../../../lib/useLeaveGuard";
import { ButtonVariant, buttonVariants } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../ui/DropdownMenu";
import Sheet from "../../../ui/Sheet";
import type { ActionReminderGroupFormInitialValues } from "./reminderGroupDraft";
import {
  ReminderGroupForm,
  type ReminderGroupFormProps,
} from "./ReminderGroupForm";
import type { ActionReminderGroupFormSubmitPayload } from "./reminderGroupRequest";

const eventOf = (group: ReminderGroupDto) => {
  const id = group.memberActionEvent?.id;
  if (id === undefined) {
    throw new Error(`reminder group ${group.id} came without its event`);
  }
  return id;
};

const ANCHOR_UNAVAILABLE =
  "Needs an upcoming dependency deadline to anchor to; this task's cohort has none";

function PresetMenu({
  dependencyDeadlineAvailable,
  onSelect,
}: {
  dependencyDeadlineAvailable: boolean;
  onSelect: (preset: ReminderPresetName) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: ButtonVariant.Default, size: "small" }),
          "inline-flex",
        )}
      >
        Load preset
        <ChevronDown aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {presetNames.map((preset) => {
          const unavailable =
            !!reminderPresets[preset].anchorToDependencyDeadline &&
            !dependencyDeadlineAvailable;
          return (
            <DropdownMenuItem
              key={preset}
              disabled={unavailable}
              title={unavailable ? ANCHOR_UNAVAILABLE : undefined}
              onClick={() => onSelect(preset)}
            >
              {preset}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type SharedFormProps = Omit<
  ReminderGroupFormProps,
  | "initialValues"
  | "anchorCandidates"
  | "waitForRecipientCount"
  | "editing"
  | "submitLabel"
  | "onDirtyChange"
  | "onSubmit"
>;

export type SheetTarget =
  | { kind: "create"; eventId: number }
  | { kind: "edit"; group: ReminderGroupDto };

/**
 * Create or edit one reminder group beside the list. Closing with unsaved
 * changes asks first; `onSaved` closes it past that question.
 */
export function ReminderGroupSheet({
  target,
  form,
  anchorCandidates,
  onClose,
  onCreate,
  onUpdate,
}: {
  target: SheetTarget;
  form: SharedFormProps;
  anchorCandidates: ReminderAnchorCandidateDto[];
  onClose: () => void;
  onCreate: (params: {
    payload: ActionReminderGroupFormSubmitPayload;
    recipientCount: number | null;
    closeSaved: () => void;
  }) => Promise<void>;
  onUpdate: (params: {
    group: ReminderGroupDto;
    payload: ActionReminderGroupFormSubmitPayload;
    closeSaved: () => void;
  }) => Promise<void>;
}) {
  const [dirty, setDirty] = useState(false);
  const leave = useLeaveGuard(dirty);
  const closeSaved = () => leave(onClose);
  const [formEventId, setFormEventId] = useState(
    target.kind === "create" ? target.eventId : null,
  );
  // A preset keeps the event picked when it loads: the form resets to these
  // values, event included.
  const [preset, setPreset] = useState<{
    name: ReminderPresetName;
    eventId: number | null;
  } | null>(null);

  // The worker can't send a time already behind its lookback window, and with
  // no candidates an anchored preset would silently become an own-deadline
  // one, so anchored presets take the next upcoming dependency deadline.
  const upcomingAnchor = anchorCandidates.find(
    (candidate) => new Date(candidate.deadlineEventDate).getTime() > Date.now(),
  );
  const resolvePreset = (
    chosen: ReminderPreset,
  ): ActionReminderGroupFormInitialValues["reminderGroup"] => {
    const { anchorToDependencyDeadline, ...rest } = chosen;
    return anchorToDependencyDeadline
      ? { ...rest, timingAnchorEventId: upcomingAnchor?.deadlineEventId }
      : rest;
  };

  const [initialValues] = useState(() => target);
  const values: ActionReminderGroupFormInitialValues =
    initialValues.kind === "edit"
      ? {
          memberActionEventId: eventOf(initialValues.group),
          reminderGroup: initialValues.group,
          users: initialValues.group.users ?? [],
        }
      : {
          memberActionEventId: preset?.eventId ?? initialValues.eventId,
          reminderGroup: preset
            ? resolvePreset(reminderPresets[preset.name])
            : null,
          users: [],
        };

  return (
    <Sheet
      open
      size="wide"
      onClose={onClose}
      title={
        target.kind === "edit"
          ? `Edit ${target.group.name}`
          : "New reminder group"
      }
      headerActions={
        target.kind === "create" && (
          <PresetMenu
            dependencyDeadlineAvailable={upcomingAnchor !== undefined}
            onSelect={(name) => setPreset({ name, eventId: formEventId })}
          />
        )
      }
    >
      <ReminderGroupForm
        {...form}
        onEventChange={(eventId) => {
          setFormEventId(eventId);
          form.onEventChange?.(eventId);
        }}
        anchorCandidates={anchorCandidates}
        initialValues={values}
        waitForRecipientCount={target.kind === "create"}
        editing={target.kind === "edit"}
        submitLabel={
          target.kind === "edit" ? "Save changes" : "Create reminders"
        }
        onDirtyChange={setDirty}
        onSubmit={(payload, recipientCount) =>
          target.kind === "edit"
            ? onUpdate({ group: target.group, payload, closeSaved })
            : onCreate({ payload, recipientCount, closeSaved })
        }
      />
    </Sheet>
  );
}
