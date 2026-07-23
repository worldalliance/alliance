import type { CohortExpression } from "@alliance/common/cohort-expression";
import { FormSchema } from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import { ActionDto, tasksCreateFormAdmin } from "@alliance/shared/client";
import type {
  FollowUpFormDto,
  FormDto,
  TagDto,
} from "@alliance/shared/client/types.gen";
import { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import { parseFollowUpFormDto } from "@alliance/shared/parsed-dtos";
import { CardStyle } from "@alliance/shared/styles/card";
import BaseButton, {
  BaseButtonVariant,
} from "@alliance/sharedweb/ui/BaseButton";
import Card from "@alliance/sharedweb/ui/Card";
import DateTimePicker from "@alliance/sharedweb/ui/DateTimePicker";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import type { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import CohortExpressionBuilder from "./CohortExpressionBuilder";
import { FormBuilder } from "./FormBuilder";

export interface ActionFollowUpFormsTabProps {
  action: ActionDto;
  availableTags: TagDto[];
  availableActions: { id: number; name: string }[];
  availableForms: FormDto[];
  availableUsers: UserSelectUser[];
}

const emptyFormSchema: FormSchema = {
  title: "Follow-up form",
  description: "",
  pages: [{ id: "page-1", title: "Page 1", fields: [] }],
  submit: { label: "Submit" },
  outputViews: [],
  aggregateViews: [],
};

function followUpFormLabel(fuf: FollowUpFormDto): string {
  const label = fuf.name?.trim();
  return label ? label : `Follow-up form #${fuf.id}`;
}

export default function ActionFollowUpFormsTab({
  action,
  availableTags,
  availableActions,
  availableForms,
  availableUsers,
}: ActionFollowUpFormsTabProps) {
  const followUpForms = useMemo(
    () => action.followUpForms ?? [],
    [action.followUpForms],
  );
  const {
    createFollowUpForm,
    updateFollowUpForm,
    deleteFollowUpForm,
    savingFollowUpFormIds,
    deletingFollowUpFormIds,
  } = useActionAdmin(action.id, { enabled: false });
  const { error: pushError } = useToast();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(
    followUpForms.length > 0 ? followUpForms[0].id : null,
  );

  const selectedForm = followUpForms.find((f) => f.id === selectedId) ?? null;

  const navigate = useNavigate();

  useEffect(() => {
    if (followUpForms.length === 0) {
      setSelectedId(null);
    } else if (
      selectedId === null ||
      !followUpForms.some((f) => f.id === selectedId)
    ) {
      setSelectedId(followUpForms[0].id);
    }
  }, [followUpForms, selectedId]);

  const handleCreateFollowUpForm = useCallback(async () => {
    setCreating(true);
    const result = await R.fromPromiseFn(async () => {
      const formRes = await tasksCreateFormAdmin({
        body: {
          title: `${action.name} - follow-up`,
          schema: emptyFormSchema,
        },
      });
      if (!formRes.data?.id) {
        throw new Error("Failed to create form");
      }
      return createFollowUpForm({
        actionId: action.id,
        formId: formRes.data.id,
      });
    });
    setCreating(false);
    if (!result.ok) {
      console.error("Failed to create follow-up form", result.error);
      pushError("Failed to create follow-up form");
      return;
    }
    setSelectedId(result.value.id);
  }, [action.id, action.name, createFollowUpForm, pushError]);

  const handleSaveFields = useCallback(
    async (
      followUpFormId: number,
      fields: {
        name: string | null;
        startDate: string | null;
        endDate: string | null;
        instructions: string | null;
        cohortExpression: CohortExpression | null;
      },
    ) => {
      const startIso = fields.startDate
        ? new Date(fields.startDate).toISOString()
        : undefined;
      const endIso = fields.endDate
        ? new Date(fields.endDate).toISOString()
        : undefined;
      const result = await R.fromPromise(
        updateFollowUpForm({
          followUpFormId,
          body: {
            name: fields.name?.trim() || null,
            startDate: startIso || null,
            endDate: endIso || null,
            instructions: fields.instructions?.trim() || null,
            cohortExpression: fields.cohortExpression,
          },
        }),
      );
      if (!result.ok) {
        console.error("Failed to save follow-up form fields", result.error);
        pushError("Failed to save follow-up form fields");
      }
    },
    [updateFollowUpForm, pushError],
  );

  const handleSetFormId = useCallback(
    async (followUpFormId: number, formId: number) => {
      const result = await R.fromPromise(
        updateFollowUpForm({ followUpFormId, body: { formId } }),
      );
      if (!result.ok) {
        console.error("Failed to set follow-up form's form", result.error);
        pushError("Failed to set follow-up form's form");
      }
    },
    [updateFollowUpForm, pushError],
  );

  const handleDeleteFollowUpForm = useCallback(
    async (followUpFormId: number) => {
      if (
        !window.confirm(
          "Delete this follow-up form? Existing responses will remain, but the form will no longer be available.",
        )
      ) {
        return;
      }
      const result = await R.fromPromise(deleteFollowUpForm(followUpFormId));
      if (!result.ok) {
        console.error("Failed to delete follow-up form", result.error);
        pushError("Failed to delete follow-up form");
        return;
      }
      setSelectedId(null);
    },
    [deleteFollowUpForm, pushError],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {followUpForms.length > 0 ? (
            <>
              <h2 className="text-lg font-semibold shrink-0">
                Follow-up form:
              </h2>
              <select
                className="border border-zinc-300 rounded-md px-3 py-1.5 bg-white min-w-0 max-w-[280px]"
                value={selectedId ?? ""}
                onChange={(e) =>
                  setSelectedId(e.target.value ? Number(e.target.value) : null)
                }
              >
                {followUpForms.map((fuf) => (
                  <option key={fuf.id} value={fuf.id}>
                    {followUpFormLabel(fuf)}
                  </option>
                ))}
              </select>
              {selectedForm && (
                <BaseButton
                  variant={BaseButtonVariant.BlueOutline}
                  onClick={() =>
                    navigate(`/forms/${selectedForm.formId}/responses`)
                  }
                >
                  View responses
                </BaseButton>
              )}
            </>
          ) : (
            <h2 className="text-lg font-semibold shrink-0">Follow-up forms</h2>
          )}
        </div>
        <BaseButton
          variant={BaseButtonVariant.Blue}
          onClick={handleCreateFollowUpForm}
          disabled={creating}
        >
          {creating ? "Creating…" : "Create follow-up form"}
        </BaseButton>
      </div>

      {followUpForms.length === 0 && !creating && (
        <Card style={CardStyle.White} className="p-6">
          <p className="text-zinc-500">
            No follow-up forms yet. Create one to add a form that is available
            during a specific date range for this action.
          </p>
        </Card>
      )}

      {selectedForm && (
        <FollowUpFormCard
          key={selectedForm.id}
          followUpForm={selectedForm}
          actionName={action.name}
          onSaveFields={handleSaveFields}
          onSetFormId={handleSetFormId}
          onDelete={handleDeleteFollowUpForm}
          savingFields={savingFollowUpFormIds.has(selectedForm.id)}
          deleting={deletingFollowUpFormIds.has(selectedForm.id)}
          availableTags={availableTags}
          availableActions={availableActions}
          availableForms={availableForms}
          availableUsers={availableUsers}
        />
      )}
    </div>
  );
}

interface FollowUpFormCardProps {
  followUpForm: FollowUpFormDto;
  actionName: string;
  onSaveFields: (
    followUpFormId: number,
    fields: {
      name: string | null;
      startDate: string | null;
      endDate: string | null;
      instructions: string | null;
      cohortExpression: CohortExpression | null;
    },
  ) => Promise<void>;
  onSetFormId: (followUpFormId: number, formId: number) => Promise<void>;
  onDelete: (followUpFormId: number) => Promise<void>;
  savingFields: boolean;
  deleting: boolean;
  availableTags: TagDto[];
  availableActions: { id: number; name: string }[];
  availableForms: FormDto[];
  availableUsers: UserSelectUser[];
}

function FollowUpFormCard({
  followUpForm,
  actionName,
  onSaveFields,
  onSetFormId,
  onDelete,
  savingFields,
  deleting,
  availableTags,
  availableActions,
  availableForms,
  availableUsers,
}: FollowUpFormCardProps) {
  const [startDate, setStartDate] = useState<string>(
    followUpForm.startDate ?? "",
  );
  const [endDate, setEndDate] = useState<string>(followUpForm.endDate ?? "");
  const [name, setName] = useState<string>(followUpForm.name ?? "");
  const [instructions, setInstructions] = useState<string>(
    followUpForm.instructions ?? "",
  );
  // parseFollowUpFormDto degrades a stored expression this bundle can't parse
  // (bad legacy row, newer server) to a warning instead of crashing the tab.
  const { followUpForm: parsedForm, cohortExpressionError } = useMemo(
    () => parseFollowUpFormDto(followUpForm),
    [followUpForm],
  );
  const [cohortExpr, setCohortExpr] = useState<CohortExpression | null>(
    parsedForm.cohortExpression ?? null,
  );

  const handleSaveFields = () => {
    // Saving would overwrite the stored (unparseable) cohort expression with
    // the empty editor state
    if (cohortExpressionError) return;
    onSaveFields(followUpForm.id, {
      name: name.trim() === "" ? null : name.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      instructions: instructions.trim() === "" ? null : instructions.trim(),
      cohortExpression: cohortExpr,
    });
  };

  return (
    <div className="space-y-6">
      <Card style={CardStyle.White} className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Name
          </label>
          <input
            type="text"
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
            placeholder={`Follow-up form #${followUpForm.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Instructions (markdown)
          </label>
          <textarea
            rows={4}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
            placeholder="Optional instructions shown to users (supports markdown)"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Target cohort
          </label>
          <p className="text-xs text-zinc-500 mb-2">
            Only users matching this cohort (who also completed the action) will
            see and be able to submit this follow-up form. Leave empty and no
            one will see this form; set a cohort to target completers.
          </p>
          {cohortExpressionError && (
            <p className="text-xs text-red-600 mb-2">
              The stored cohort expression could not be parsed and is not shown
              below (details in the console). Saving is disabled so it
              isn&apos;t accidentally deleted — fix the stored data, then
              refresh the page.
            </p>
          )}
          <CohortExpressionBuilder
            value={cohortExpr}
            onChange={setCohortExpr}
            availableTags={availableTags}
            availableActions={availableActions}
            availableForms={availableForms}
            availableUsers={availableUsers}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Start date
            </label>
            <DateTimePicker
              value={startDate}
              onChange={(change) => setStartDate(change.utcValue ?? "")}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              End date
            </label>
            <DateTimePicker
              value={endDate}
              onChange={(change) => setEndDate(change.utcValue ?? "")}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <BaseButton
            variant={BaseButtonVariant.Black}
            onClick={handleSaveFields}
            disabled={savingFields || cohortExpressionError != null}
          >
            {savingFields ? "Saving…" : "Save fields"}
          </BaseButton>
          <BaseButton
            variant={BaseButtonVariant.RedOutline}
            onClick={() => onDelete(followUpForm.id)}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete follow-up form"}
          </BaseButton>
        </div>
      </Card>

      <Card style={CardStyle.White} className="p-4">
        <h3 className="text-sm font-medium text-zinc-700 mb-2">Form</h3>
        <FormBuilder
          formId={followUpForm.formId}
          setFormId={(formId) => onSetFormId(followUpForm.id, formId)}
          actionName={`${actionName} follow-up`}
        />
      </Card>
    </div>
  );
}
