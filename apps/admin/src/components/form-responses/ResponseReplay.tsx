import type { AnyField } from "@alliance/common/forms/form-schema";
import type { FormResponseDto } from "@alliance/shared/client";
import { parseStoredFormSchema } from "@alliance/shared/parsed-dtos";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import React, { useMemo } from "react";
import { AI_SCORE_FIELD_KINDS, formatAiScore } from "../../lib/aiScore";
import Badge, { BadgeTone } from "../../ui/Badge";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { PageBody } from "../../ui/templates/Page";
import { ContentState, FormSkeleton } from "../../ui/templates/States";
import type { FormWithSchema } from "../FormResponsesView";

type ResponseReplayProps = {
  loading: boolean;
  error: string | null;
  form: FormWithSchema | null;
  filteredTotal: number;
  filterActive: boolean;
  onClearFilter: () => void;
  currentResponse: FormResponseDto | undefined;
  fieldsById: Map<string, AnyField>;
};

const ResponseReplay: React.FC<ResponseReplayProps> = ({
  loading,
  error,
  form,
  filteredTotal,
  filterActive,
  onClearFilter,
  currentResponse,
  fieldsById,
}) => {
  const aiScoreLabels = useMemo<Record<string, React.ReactNode>>(() => {
    const labels: Record<string, React.ReactNode> = {};
    for (const detection of currentResponse?.aiDetectionResults ?? []) {
      if (!detection.fieldPath.startsWith("answers.")) continue;
      const fieldId = detection.fieldPath.slice("answers.".length);
      const field = fieldsById.get(fieldId);
      if (!field || !AI_SCORE_FIELD_KINDS.has(field.kind)) continue;
      if (
        typeof detection.aiProbability !== "number" ||
        Number.isNaN(detection.aiProbability) ||
        detection.aiProbability <= 0
      ) {
        continue;
      }
      labels[fieldId] = (
        <Badge tone={BadgeTone.Danger} className="self-auto">
          AI score {formatAiScore(detection.aiProbability)}
        </Badge>
      );
    }
    return labels;
  }, [currentResponse, fieldsById]);

  const snapshot = useMemo(
    () =>
      currentResponse?.schemaSnapshot
        ? parseStoredFormSchema(currentResponse.schemaSnapshot)
        : null,
    [currentResponse],
  );
  const skeleton = (
    <div className="mx-auto w-full max-w-xl">
      <FormSkeleton fields={5} />
    </div>
  );

  return (
    <PageBody>
      <ContentState
        loading={loading || (form === null && filteredTotal > 0)}
        skeleton={skeleton}
        error={error}
        errorTitle="Couldn't load responses"
        empty={filteredTotal === 0}
        filtered={filterActive}
        onClearFilters={onClearFilter}
        emptyTitle="No responses yet"
      >
        {form && (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
            {currentResponse?.schemaSnapshot && snapshot === null && (
              <Banner tone={BannerTone.Warning} inline>
                This response's saved version of the form couldn't be read, so
                its answers are shown in the current version of {form.title}.
              </Banner>
            )}
            <div className="member-surface rounded-card border border-line bg-surface p-6">
              <FormRenderer
                id={currentResponse?.formId ?? form.id}
                formSnapshotId={
                  currentResponse?.formSnapshotId ?? form.formSnapshotId
                }
                actionId={0}
                form={snapshot ?? form.schema}
                completedFormResponse={currentResponse}
                renderFormAsCompleted
                onSubmit={null}
                userId={currentResponse?.user?.id}
                user={currentResponse?.user ?? undefined}
                adminPreviewUserId={currentResponse?.user?.id}
                showDetail
                disableOptionRandomization
                fieldLabelRightContent={aiScoreLabels}
              />
            </div>
          </div>
        )}
      </ContentState>
    </PageBody>
  );
};

export default ResponseReplay;
