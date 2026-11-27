import {
  isQuestionField,
  type AnyField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import type {
  ActionWithdrawalDto,
  FormResponseDto,
  ProfileDto,
} from "@alliance/shared/client";
import { parseStoredFormSchema } from "@alliance/shared/parsed-dtos";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import { ChevronDown, ChevronUp, CirclePlay } from "lucide-react";
import React, { useMemo } from "react";
import { AI_SCORE_FIELD_KINDS, formatAiScore } from "../../lib/aiScore";
import { formatCount } from "../../lib/formatNumber";
import { posthogReplayHref } from "../../lib/posthogReplay";
import { respondentName } from "../../lib/respondent";
import Button, { ButtonVariant } from "../../ui/Button";
import NewTabMark from "../../ui/NewTabMark";
import Sheet from "../../ui/Sheet";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Fact, FactList } from "../../ui/templates/Record";
import type { FormWithSchema } from "../FormResponsesView";
import { IdentityChip } from "../IdentitySwatch";
import { WithdrawalInfo } from "../WithdrawalInfo";
import { formatSubmitted } from "./rows";
import { snapshotSeed } from "./SnapshotNavigator";

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
  const snapshot = useMemo(
    () => (response ? parseStoredFormSchema(response.schemaSnapshot) : null),
    [response],
  );

  const schema: FormSchema | null = snapshot ?? form?.schema ?? null;

  const fieldsById = useMemo(() => {
    const fields = new Map<string, AnyField>();
    schema?.pages?.forEach((page) => {
      page.fields.forEach((field) => {
        if (isQuestionField(field)) fields.set(field.id, field);
      });
    });
    return fields;
  }, [schema]);

  const aiScores = useMemo(
    () =>
      (response?.aiDetectionResults ?? []).flatMap((detection) => {
        if (!detection.fieldPath.startsWith("answers.")) return [];
        const fieldId = detection.fieldPath.slice("answers.".length);
        const field = fieldsById.get(fieldId);
        const score = detection.aiProbability;
        if (!field || !AI_SCORE_FIELD_KINDS.has(field.kind)) return [];
        if (typeof score !== "number" || Number.isNaN(score) || score <= 0) {
          return [];
        }
        return [{ fieldId, label: field.label ?? fieldId, score }];
      }),
    [response, fieldsById],
  );

  const aiInlineLabels = useMemo<Record<string, React.ReactNode>>(
    () =>
      Object.fromEntries(
        aiScores.map(({ fieldId, score }) => [
          fieldId,
          <span key={fieldId} className="font-semibold text-danger">
            AI {formatAiScore(score)}
          </span>,
        ]),
      ),
    [aiScores],
  );

  const withdrawal =
    response?.user?.id == null
      ? null
      : (withdrawnUserMap.get(response.user.id) ?? null);

  return (
    <Sheet
      open={response !== null}
      onClose={onClose}
      title={
        response ? respondentName({ response, sidsToUserMap }) : "Response"
      }
      headerActions={
        <>
          <span className="mr-1 text-caption text-fg-muted tabular-nums">
            {formatCount(position.index + 1)} of {formatCount(position.total)}
          </span>
          <Button
            variant={ButtonVariant.Ghost}
            size="small"
            disabled={position.index <= 0}
            onClick={() => onStep(-1)}
            aria-label="Previous response"
            title="Previous response"
          >
            <ChevronUp aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant={ButtonVariant.Ghost}
            size="small"
            disabled={position.index >= position.total - 1}
            onClick={() => onStep(1)}
            aria-label="Next response"
            title="Next response"
          >
            <ChevronDown aria-hidden="true" className="size-4" />
          </Button>
        </>
      }
    >
      {response && (
        <div className="flex flex-col gap-section p-card">
          <FactList>
            <Fact label="Submitted">{formatSubmitted(response.createdAt)}</Fact>
            <Fact label="Version">
              <IdentityChip
                seed={snapshotSeed(response.formSnapshotId)}
                label={`v${response.formSnapshotId}`}
              />
            </Fact>
            <Fact label="Response ID">
              <span className="font-mono text-xs">{response.id}</span>
            </Fact>
            <Fact label="User ID">
              <span className="font-mono text-xs">
                {response.user?.id ?? "—"}
              </span>
            </Fact>
            <Fact label="SID">
              <span className="font-mono text-xs break-all">
                {response.sid || "—"}
              </span>
            </Fact>
            <Fact label="Device">{response.deviceType || "—"}</Fact>
            {withdrawal && (
              <Fact label="Withdrawal">
                <WithdrawalInfo withdrawal={withdrawal} />
              </Fact>
            )}
            {aiScores.length > 0 && (
              <Fact label="AI detection">
                <ul className="flex flex-col py-2">
                  {aiScores.map((entry) => (
                    <li key={entry.fieldId}>
                      <span className="font-semibold text-danger tabular-nums">
                        {formatAiScore(entry.score)}
                      </span>{" "}
                      {entry.label}
                    </li>
                  ))}
                </ul>
              </Fact>
            )}
            {response.sessionReplayUrl && (
              <Fact label="Replay">
                <a
                  href={posthogReplayHref(response.sessionReplayUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-sm font-medium text-accent focus-ring hover:underline"
                >
                  <CirclePlay aria-hidden="true" className="size-4" />
                  Watch replay
                  <NewTabMark />
                </a>
              </Fact>
            )}
          </FactList>

          {response && snapshot === null && form && (
            <Banner tone={BannerTone.Warning} inline>
              This response's saved version of the form couldn't be read, so its
              answers are shown in the current version of {form.title}.
            </Banner>
          )}

          {schema && form ? (
            <div className="member-surface rounded-card border border-line bg-surface p-card">
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
                showDetail
                disableOptionRandomization
                fieldLabelRightContent={aiInlineLabels}
              />
            </div>
          ) : (
            <Banner tone={BannerTone.Danger} inline>
              No form questions are available to show this response.
            </Banner>
          )}
        </div>
      )}
    </Sheet>
  );
};

export default ResponseDrawer;
