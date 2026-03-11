import {
  Action,
  actionsCreateFollowUpForm,
  actionsFindOneAdmin,
  actionsUpdateFollowUpForm,
  tasksCreateForm,
} from "@alliance/shared/client";
import type { FollowUpFormDto } from "@alliance/shared/client/types.gen";
import BaseButton, {
  BaseButtonVariant,
} from "@alliance/sharedweb/ui/BaseButton";
import Card from "@alliance/sharedweb/ui/Card";
import DateTimePicker from "@alliance/sharedweb/ui/DateTimePicker";
import { CardStyle } from "@alliance/shared/styles/card";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { FormBuilder } from "./FormBuilder";

export interface ActionFollowUpFormsTabProps {
  action: Action;
  setAction: (action: Action) => void;
}

const emptyFormSchema = {
  title: "Follow-up form",
  description: "",
  pages: [{ id: "page-1", title: "Page 1", fields: [] }],
  submit: { label: "Complete" },
  outputViews: [],
};

function followUpFormLabel(fuf: FollowUpFormDto): string {
  const label = fuf.name?.trim();
  return label ? label : `Follow-up form #${fuf.id}`;
}

export default function ActionFollowUpFormsTab({
  action,
  setAction,
}: ActionFollowUpFormsTabProps) {
  const followUpForms = useMemo(
    () => action.followUpForms ?? [],
    [action.followUpForms]
  );
  const [creating, setCreating] = useState(false);
  const [savingFields, setSavingFields] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(
    followUpForms.length > 0 ? followUpForms[0].id : null
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

  const refetchAction = useCallback(async () => {
    const res = await actionsFindOneAdmin({ path: { id: action.id } });
    if (res.data) setAction(res.data);
  }, [action.id, setAction]);

  const handleCreateFollowUpForm = useCallback(async () => {
    setCreating(true);
    try {
      const formRes = await tasksCreateForm({
        body: {
          title: `${action.name} - follow-up`,
          schema: emptyFormSchema as unknown as Record<string, unknown>,
        },
      });
      if (!formRes.data?.id) {
        throw new Error("Failed to create form");
      }
      const createRes = await actionsCreateFollowUpForm({
        path: { id: action.id },
        body: {
          actionId: action.id,
          formId: formRes.data.id,
        },
      });
      if (createRes.data) {
        await refetchAction();
        setSelectedId(createRes.data.id);
      }
    } finally {
      setCreating(false);
    }
  }, [action.id, action.name, refetchAction]);

  const handleSaveFields = useCallback(
    async (
      followUpFormId: number,
      fields: {
        name: string | null;
        startDate: string | null;
        endDate: string | null;
      }
    ) => {
      setSavingFields(followUpFormId);
      try {
        const startIso = fields.startDate
          ? new Date(fields.startDate).toISOString()
          : undefined;
        const endIso = fields.endDate
          ? new Date(fields.endDate).toISOString()
          : undefined;
        const res = await actionsUpdateFollowUpForm({
          path: { followUpFormId },
          body: {
            name: fields.name?.trim() ?? "",
            startDate: startIso,
            endDate: endIso,
          },
        });
        if (res.data) {
          await refetchAction();
        }
      } finally {
        setSavingFields(null);
      }
    },
    [refetchAction]
  );

  const handleSetFormId = useCallback(
    async (followUpFormId: number, formId: number) => {
      await actionsUpdateFollowUpForm({
        path: { followUpFormId },
        body: { formId },
      });
      await refetchAction();
    },
    [refetchAction]
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
          savingFields={savingFields === selectedForm.id}
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
    }
  ) => Promise<void>;
  onSetFormId: (followUpFormId: number, formId: number) => Promise<void>;
  savingFields: boolean;
}

function FollowUpFormCard({
  followUpForm,
  actionName,
  onSaveFields,
  onSetFormId,
  savingFields,
}: FollowUpFormCardProps) {
  const [startDate, setStartDate] = useState<string>(
    followUpForm.startDate ?? ""
  );
  const [endDate, setEndDate] = useState<string>(followUpForm.endDate ?? "");
  const [name, setName] = useState<string>(followUpForm.name ?? "");

  const handleSaveFields = () => {
    onSaveFields(followUpForm.id, {
      name: name.trim() === "" ? null : name.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
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

        <BaseButton
          variant={BaseButtonVariant.Black}
          onClick={handleSaveFields}
          disabled={savingFields}
        >
          {savingFields ? "Saving…" : "Save fields"}
        </BaseButton>
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
