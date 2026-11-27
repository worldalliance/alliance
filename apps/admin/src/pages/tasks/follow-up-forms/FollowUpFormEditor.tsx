import type { AdminFollowUpFormDto } from "@alliance/shared/client/types.gen";
import { parseFollowUpFormDto } from "@alliance/shared/parsed-dtos";
import { useMemo, useState, type ReactNode } from "react";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { followUpFormLabel } from "../../../lib/followUpFormLabel";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import { useLeaveGuard } from "../../../lib/useLeaveGuard";
import Button, { ButtonVariant } from "../../../ui/Button";
import DateTimePicker, { timeZoneLabel } from "../../../ui/DateTimePicker";
import { Input } from "../../../ui/Input";
import { Textarea } from "../../../ui/Textarea";
import { Banner, BannerTone } from "../../../ui/templates/Banner";
import {
  Field,
  FieldGroup,
  FormSection,
  SAVE_FAILED_FALLBACK,
  SaveBar,
  SaveState,
} from "../../../ui/templates/Form";
import CohortExpressionBuilder from "../cohort/CohortExpressionBuilder";
import type { TaskTabProps } from "../taskTabs";
import {
  draftOf,
  isDraftDirty,
  saveNote,
  UNREADABLE_COHORT_NOTE,
  updateBodyOf,
  windowError,
  type FollowUpDraft,
} from "./followUpRules";

type Lookups = TaskTabProps["lookups"];

const ZONE = timeZoneLabel(LAUNCH_TIME_ZONE);

// The embedded builder's views; any other change of tab or form drops the draft.
const BUILDER_PARAMS = ["editor", "select"];

export function FollowUpFormEditor({
  form,
  lookups,
  onSave,
  onDelete,
  deleting,
  builder,
}: {
  form: AdminFollowUpFormDto;
  lookups: Lookups;
  onSave: (body: ReturnType<typeof updateBodyOf>) => Promise<void>;
  onDelete: () => Promise<void>;
  deleting: boolean;
  /** The embedded builder for the follow-up's form. */
  builder: ReactNode;
}) {
  const confirm = useConfirmOnPage();
  const { followUpForm: parsed, cohortExpressionError } = useMemo(
    () => parseFollowUpFormDto(form),
    [form],
  );
  const stored = useMemo(
    () => draftOf(form, parsed.cohortExpression),
    [form, parsed.cohortExpression],
  );
  const [seeded, setSeeded] = useState(stored);
  const [draft, setDraft] = useState(stored);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<
    { saved: true } | { saved: false; reason: string } | null
  >(null);
  const [showErrors, setShowErrors] = useState(false);
  const dirty = isDraftDirty(draft, seeded);
  useLeaveGuard(dirty, { ignoreParams: BUILDER_PARAMS });

  // A refetch reseeds the fields only while they are untouched.
  if (isDraftDirty(stored, seeded) && !dirty) {
    setSeeded(stored);
    setDraft(stored);
  }

  const dateError = showErrors ? windowError(draft) : null;
  const change = (patch: Partial<FollowUpDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setOutcome(null);
  };

  const save = async () => {
    if (cohortExpressionError) {
      setOutcome({ saved: false, reason: UNREADABLE_COHORT_NOTE });
      return;
    }
    if (windowError(draft)) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setOutcome(null);
    try {
      await onSave(updateBodyOf(draft));
      setSeeded(draft);
      setOutcome({ saved: true });
    } catch (thrown) {
      console.error("Couldn't save the follow-up form's fields", thrown);
      setOutcome({
        saved: false,
        reason: adminRefusalMessage(thrown, SAVE_FAILED_FALLBACK),
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${followUpFormLabel(form)}”?`,
      message:
        "Members stop seeing this follow-up form. The form itself and the responses already submitted are kept, and stay on the form's Responses tab.",
      confirmLabel: "Delete follow-up form",
      destructive: true,
    });
    if (ok) await onDelete();
  };

  const state = saving
    ? SaveState.Saving
    : outcome?.saved === false
      ? SaveState.Failed
      : dirty
        ? SaveState.Dirty
        : outcome?.saved
          ? SaveState.Saved
          : SaveState.Clean;

  return (
    <>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <FormSection
          title="Settings"
          description="Who is asked, when, and what they read first. Saved with the button below, not as you type."
          footer={
            <SaveBar
              state={state}
              error={outcome?.saved === false ? outcome.reason : null}
              note={saveNote(draft, {
                cohortUnreadable: cohortExpressionError != null,
              })}
              saveLabel="Save fields"
              onDiscard={() => {
                setDraft(seeded);
                setOutcome(null);
                setShowErrors(false);
              }}
            />
          }
        >
          <Field label="Name" mark="optional">
            {(control) => (
              <Input
                {...control}
                value={draft.name}
                placeholder={`Follow-up form #${form.id}`}
                onChange={(event) => change({ name: event.target.value })}
              />
            )}
          </Field>
          <Field
            label="Instructions"
            mark="optional"
            help="Shown to members above the form. Markdown works."
          >
            {(control) => (
              <Textarea
                {...control}
                rows={4}
                value={draft.instructions}
                onChange={(event) =>
                  change({ instructions: event.target.value })
                }
              />
            )}
          </Field>
          <FieldGroup
            label="Target cohort"
            help="Only members in this cohort who also completed the task see this form and can submit it. With no cohort, nobody sees it."
          >
            {cohortExpressionError && (
              <Banner tone={BannerTone.Warning} inline>
                The stored cohort couldn&apos;t be read, so it isn&apos;t shown
                and saving is off, which keeps it from being replaced by an
                empty one. Fix the stored data, then reload.
              </Banner>
            )}
            <CohortExpressionBuilder
              value={draft.cohortExpression}
              unreadable={cohortExpressionError != null}
              emptyHint="Nobody sees this form until it has a cohort."
              onChange={(cohortExpression) => change({ cohortExpression })}
              availableTags={lookups.availableTags}
              tagsLoading={lookups.tagsLoading}
              tagsError={lookups.tagsError}
              availableActions={lookups.allActions}
              actionsLoading={lookups.allActionsLoading}
              actionsError={lookups.allActionsLoadFailed}
              availableUsers={lookups.availableUsers}
              usersLoading={lookups.usersLoading}
              usersError={lookups.usersError}
            />
          </FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={`Start date (${ZONE})`}
              mark="optional"
              help="Until it starts, nobody sees the form."
            >
              {(control) => (
                <DateTimePicker
                  {...control}
                  timeZone={LAUNCH_TIME_ZONE}
                  value={draft.startDate}
                  onChange={(c) => change({ startDate: c.utcValue ?? "" })}
                />
              )}
            </Field>
            <Field
              label={`End date (${ZONE})`}
              mark="optional"
              help="After it, the form closes. Empty keeps it open."
              error={dateError}
            >
              {(control) => (
                <DateTimePicker
                  {...control}
                  timeZone={LAUNCH_TIME_ZONE}
                  value={draft.endDate}
                  onChange={(c) => change({ endDate: c.utcValue ?? "" })}
                />
              )}
            </Field>
          </div>
        </FormSection>
      </form>

      <FormSection
        title="Form"
        description="The questions members answer. The builder saves on its own, apart from the settings above."
      >
        <div className="flex h-176 min-h-120 flex-col overflow-hidden rounded-card border border-line">
          {builder}
        </div>
      </FormSection>

      <section className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-card">
        <p className="text-fg-muted">
          Deleting stops members seeing this follow-up form. Its form and
          responses are kept.
        </p>
        <Button
          variant={ButtonVariant.DangerOutline}
          onClick={() => void remove()}
          busy={deleting}
          className="shrink-0"
        >
          Delete follow-up form…
        </Button>
      </section>
    </>
  );
}
