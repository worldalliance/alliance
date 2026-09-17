import {
  flattenPageItems,
  formSchema,
  isQuestionField,
  type AnyField,
  type FieldKind,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import type {
  ActionWithdrawalDto,
  FormResponseDto,
  ProfileDto,
} from "@alliance/shared/client";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ChevronLeft, ChevronRight, CirclePlay } from "lucide-react";
import React, { useMemo } from "react";
import { respondentName } from "../../lib/respondent";
import type { FormWithSchema } from "../FormResponsesView";
import { IdentityChip } from "../IdentitySwatch";
import SideDrawer from "../SideDrawer";
import { WithdrawalInfo } from "../WithdrawalInfo";
import { formatSubmitted } from "./rows";
import { snapshotSeed } from "./SnapshotNavigator";

const AI_SCORE_FIELD_KINDS = new Set<FieldKind>(["text", "textarea"]);

const POSTHOG_REPLAY_BASE =
  "https://us.posthog.com/project/188181/replay/home?sessionRecordingId=";

const formatAiScore = (value: number): string => `${Math.round(value * 100)}%`;

const MetaRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex items-baseline gap-2">
    <dt className="w-28 shrink-0 text-xs tracking-wide text-zinc-500 uppercase">
      {label}
    </dt>
    <dd className="min-w-0 flex-1 text-sm break-words text-zinc-900">
      {children}
    </dd>
  </div>
);

export type ResponseDrawerProps = {
  response: FormResponseDto | null;
  form: FormWithSchema | null;
  sidsToUserMap: Record<string, ProfileDto>;
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  position: { index: number; total: number };
  onClose: () => void;
  onStep: (offset: number) => void;
};

const ResponseDrawer: React.FC<ResponseDrawerProps> = ({
  response,
  form,
  sidsToUserMap,
  withdrawnUserMap,
  position,
  onClose,
  onStep,
}) => {
  const parsedSnapshot = useMemo(() => {
    if (!response) return null;
    return formSchema.safeParse(response.schemaSnapshot);
  }, [response]);

  const schema: FormSchema | null =
    parsedSnapshot?.success === true
      ? parsedSnapshot.data
      : (form?.schema ?? null);

  const fieldsById = useMemo(() => {
    const fields = new Map<string, AnyField>();
    schema?.pages?.forEach((page) => {
      flattenPageItems(page.fields).forEach((field) => {
        if (isQuestionField(field)) fields.set(field.id, field);
      });
    });
    return fields;
  }, [schema]);

  const aiScores = useMemo(() => {
    const entries: Array<{ label: string; fieldId: string; score: number }> =
      [];
    for (const detection of response?.aiDetectionResults ?? []) {
      if (!detection.fieldPath.startsWith("answers.")) continue;
      const fieldId = detection.fieldPath.slice("answers.".length);
      const field = fieldsById.get(fieldId);
      if (!field || !AI_SCORE_FIELD_KINDS.has(field.kind)) continue;
      const score = detection.aiProbability;
      if (typeof score !== "number" || Number.isNaN(score) || score <= 0) {
        continue;
      }
      entries.push({ fieldId, label: field.label ?? fieldId, score });
    }
    return entries;
  }, [response, fieldsById]);

  const aiInlineLabels = useMemo<Record<string, React.ReactNode>>(
    () =>
      Object.fromEntries(
        aiScores.map(({ fieldId, score }) => [
          fieldId,
          <span key={fieldId} className="text-sm font-semibold text-red-600">
            {formatAiScore(score)}
          </span>,
        ]),
      ),
    [aiScores],
  );

  const withdrawal =
    response?.user?.id == null
      ? null
      : (withdrawnUserMap.get(response.user.id) ?? null);

  const replayId = response?.sessionReplayUrl?.split("/").pop();

  return (
    <SideDrawer
      open={response !== null}
      onClose={onClose}
      title={
        response
          ? respondentName({ response, sidsToUserMap })
          : "Response details"
      }
      headerActions={
        <>
          <span className="mr-1 text-xs text-zinc-500">
            {position.index + 1} of {position.total}
          </span>
          <Button
            size="small"
            color={ButtonColor.White}
            disabled={position.index <= 0}
            onClick={() => onStep(-1)}
            aria-label="Previous response"
            title="Previous response"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <Button
            size="small"
            color={ButtonColor.White}
            disabled={position.index >= position.total - 1}
            onClick={() => onStep(1)}
            aria-label="Next response"
            title="Next response"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </>
      }
    >
      {response && (
        <div className="space-y-5 p-5">
          <dl className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <MetaRow label="Submitted">
              {formatSubmitted(response.createdAt)}
            </MetaRow>
            <MetaRow label="Version">
              <IdentityChip
                seed={snapshotSeed(response.formSnapshotId)}
                label={`v${response.formSnapshotId}`}
              />
            </MetaRow>
            <MetaRow label="Response ID">{response.id}</MetaRow>
            <MetaRow label="User ID">{response.user?.id ?? "—"}</MetaRow>
            <MetaRow label="SID">{response.sid || "—"}</MetaRow>
            <MetaRow label="Device">{response.deviceType || "—"}</MetaRow>
            {withdrawal && (
              <MetaRow label="Withdrawal">
                <WithdrawalInfo withdrawal={withdrawal} />
              </MetaRow>
            )}
            {aiScores.length > 0 && (
              <MetaRow label="AI detection">
                <ul className="space-y-0.5">
                  {aiScores.map((entry) => (
                    <li key={entry.fieldId}>
                      <span className="font-semibold text-red-600">
                        {formatAiScore(entry.score)}
                      </span>{" "}
                      <span className="text-zinc-600">{entry.label}</span>
                    </li>
                  ))}
                </ul>
              </MetaRow>
            )}
            {replayId && (
              <MetaRow label="Replay">
                <Button
                  size="small"
                  color={ButtonColor.BlueOutline}
                  onClick={() =>
                    window.open(`${POSTHOG_REPLAY_BASE}${replayId}`, "_blank")
                  }
                >
                  <CirclePlay aria-hidden="true" className="mr-1.5 size-3.5" />
                  Watch replay
                </Button>
              </MetaRow>
            )}
          </dl>

          {parsedSnapshot?.success === false && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This response&rsquo;s own snapshot did not parse, so the form
              below is rendered from the form&rsquo;s current schema.
            </p>
          )}

          {schema && form ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <FormRenderer
                id={response.formId}
                formSnapshotId={response.formSnapshotId}
                actionId={0}
                form={schema}
                completedFormResponse={response}
                renderFormAsCompleted
                onSubmit={null}
                userId={response.user?.id}
                user={response.user ?? undefined}
                adminPreviewUserId={response.user?.id}
                disableOptionRandomization
                fieldLabelRightContent={aiInlineLabels}
              />
            </div>
          ) : (
            <p className="text-sm text-red-600">
              No schema available to render this response.
            </p>
          )}
        </div>
      )}
    </SideDrawer>
  );
};

export default ResponseDrawer;
