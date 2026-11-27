import type { FormSchema } from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import type { AdminFollowUpFormDto } from "@alliance/shared/client/types.gen";
import { useCreateFormAdmin } from "@alliance/shared/lib/useFormsAdmin";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { FormBuilder } from "../../../components/FormBuilder";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { followUpFormLabel } from "../../../lib/followUpFormLabel";
import { fromApi } from "../../../lib/fromApi";
import Badge, { BadgeTone } from "../../../ui/Badge";
import Button, { ButtonVariant } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { EmptyState } from "../../../ui/EmptyState";
import { Panel } from "../../../ui/templates/Overview";
import { useToast } from "../../../ui/ToastProvider";
import type { TaskTabProps } from "../taskTabs";
import { FollowUpFormEditor } from "./FollowUpFormEditor";
import {
  FOLLOW_UP_PARAM,
  FOLLOW_UP_STATUS_LABEL,
  FollowUpStatus,
  followUpStatus,
  followUpWindow,
} from "./followUpRules";

const emptyFormSchema: FormSchema = {
  description: "",
  pages: [{ id: "page-1", title: "Page 1", fields: [] }],
  submit: { label: "Submit" },
  outputViews: [],
  aggregateViews: [],
};

const STATUS_TONE: Record<FollowUpStatus, BadgeTone> = {
  [FollowUpStatus.NoCohort]: BadgeTone.Warning,
  [FollowUpStatus.NoStart]: BadgeTone.Warning,
  [FollowUpStatus.Scheduled]: BadgeTone.Info,
  [FollowUpStatus.Open]: BadgeTone.Success,
  [FollowUpStatus.Ended]: BadgeTone.Neutral,
};

export function FollowUpFormsTab({ task, admin, lookups }: TaskTabProps) {
  const { error: pushError, success } = useToast();
  const { createForm } = useCreateFormAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  // Covers both writes; the admin's pending flag covers only the second.
  const [creating, setCreating] = useState(false);
  const forms = task.followUpForms ?? [];
  const asked = Number(searchParams.get(FOLLOW_UP_PARAM));
  const selected = forms.find((f) => f.id === asked) ?? forms[0] ?? null;

  const select = (id: number) => {
    if (id === selected?.id) return;
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.set(FOLLOW_UP_PARAM, String(id));
        return next;
      },
      { replace: true },
    );
  };

  const create = async () => {
    setCreating(true);
    const result = await R.fromPromiseFn(
      async () => {
        const { id: formId } = await createForm({
          title: `${task.name} - follow-up`,
          schema: emptyFormSchema,
        });
        return admin.createFollowUpForm({ actionId: task.id, formId });
      },
      (error) => error,
    );
    setCreating(false);
    if (!result.ok) {
      console.error("Couldn't create the follow-up form", result.error);
      pushError(
        adminRefusalMessage(
          result.error,
          "Couldn't create the follow-up form.",
        ),
      );
      return;
    }
    select(result.value.id);
  };

  const remove = async (form: AdminFollowUpFormDto) => {
    const result = await fromApi(admin.deleteFollowUpForm(form.id));
    if (!result.ok) {
      console.error("Couldn't delete the follow-up form", result.error);
      pushError(
        adminRefusalMessage(
          result.error,
          "Couldn't delete the follow-up form.",
        ),
      );
      return;
    }
    success("Follow-up form deleted", followUpFormLabel(form));
  };

  const relink = async (form: AdminFollowUpFormDto, formId: number) => {
    if (formId === form.formId) return;
    const result = await fromApi(
      admin.updateFollowUpForm({ followUpFormId: form.id, body: { formId } }),
    );
    if (!result.ok) {
      console.error("Couldn't link the saved form", result.error);
      pushError(
        adminRefusalMessage(
          result.error,
          "The form saved, but the follow-up still shows the old one.",
        ),
      );
    }
  };

  const now = new Date();

  return (
    <>
      <Panel
        title="Follow-up forms"
        description="A second form, shown after the task to a cohort between two dates."
        flush
        action={
          <Button
            variant={ButtonVariant.Primary}
            onClick={() => void create()}
            busy={creating}
          >
            Create follow-up form
          </Button>
        }
      >
        {forms.length === 0 ? (
          <EmptyState
            title="No follow-up forms yet"
            description="Create one to ask members who completed this task a second set of questions between two dates."
          />
        ) : (
          <ul>
            {forms.map((form) => (
              <FollowUpRow
                key={form.id}
                form={form}
                now={now}
                selected={form.id === selected?.id}
                onSelect={() => select(form.id)}
              />
            ))}
          </ul>
        )}
      </Panel>

      {selected && (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-heading font-semibold">
              {followUpFormLabel(selected)}
            </h2>
            <Button
              variant={ButtonVariant.Default}
              to={`/tasks/forms/${selected.formId}?tab=responses`}
            >
              View responses
            </Button>
          </div>
          <FollowUpFormEditor
            key={selected.id}
            form={selected}
            lookups={lookups}
            deleting={admin.deletingFollowUpFormIds.has(selected.id)}
            onSave={async (body) => {
              await admin.updateFollowUpForm({
                followUpFormId: selected.id,
                body,
              });
            }}
            onDelete={() => remove(selected)}
            builder={
              <FormBuilder
                formId={selected.formId}
                setFormId={(formId) => void relink(selected, formId)}
                actionName={`${task.name} follow-up`}
              />
            }
          />
        </>
      )}
    </>
  );
}

function FollowUpRow({
  form,
  now,
  selected,
  onSelect,
}: {
  form: AdminFollowUpFormDto;
  now: Date;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = followUpStatus(form, now);
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 px-card py-3 text-left hover:bg-surface-2",
          selected && "bg-accent-soft",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {followUpFormLabel(form)}
          </span>
          <span className="block text-caption text-fg-muted">
            {followUpWindow(form)}
          </span>
        </span>
        <Badge tone={STATUS_TONE[status]}>
          {FOLLOW_UP_STATUS_LABEL[status]}
        </Badge>
      </button>
    </li>
  );
}
