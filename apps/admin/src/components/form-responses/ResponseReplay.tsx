import type { AnyField, FormSchema } from "@alliance/common/forms/form-schema";
import type { FormResponseDto } from "@alliance/shared/client";
import { CardStyle } from "@alliance/shared/styles/card";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import React, { useMemo } from "react";
import { AI_SCORE_FIELD_KINDS, formatAiScore } from "../../lib/aiScore";
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
  const currentResponseAiInlineLabels = useMemo<
    Record<string, React.ReactNode>
  >(() => {
    const detections = currentResponse?.aiDetectionResults ?? [];
    const inlineScores: Record<string, React.ReactNode> = {};

    for (const detection of detections) {
      if (!detection.fieldPath.startsWith("answers.")) {
        continue;
      }
      const fieldId = detection.fieldPath.slice("answers.".length);
      const field = fieldsById.get(fieldId);
      if (!field || !AI_SCORE_FIELD_KINDS.has(field.kind)) {
        continue;
      }
      if (
        typeof detection.aiProbability !== "number" ||
        Number.isNaN(detection.aiProbability) ||
        detection.aiProbability <= 0
      ) {
        continue;
      }
      inlineScores[fieldId] = (
        <span className="text-sm font-semibold text-red-600">
          {formatAiScore(detection.aiProbability)}
        </span>
      );
    }

    return inlineScores;
  }, [currentResponse, fieldsById]);

  const emptyStateMessage = filterActive
    ? "No responses match this filter."
    : "No responses yet for this form.";

  return (
    <div className="px-2">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading responses...</p>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-red-500">{error}</p>
        </div>
      ) : filteredTotal === 0 ? (
        <Card style={CardStyle.White} className="flex items-center gap-3">
          <p className="text-gray-600">{emptyStateMessage}</p>
          {filterActive && (
            <Button
              onClick={onClearFilter}
              color={ButtonColor.White}
              size="small"
            >
              Clear filter
            </Button>
          )}
        </Card>
      ) : (
        <>
          {form !== null && (
            <div className="max-w-[600px] mx-auto">
              {(() => {
                const responseSchema =
                  (currentResponse?.schemaSnapshot as unknown as FormSchema) ??
                  form.schema;
                return (
                  <div className="bg-white p-6 border border-gray-200 rounded-lg">
                    <FormRenderer
                      id={currentResponse?.formId ?? form.id}
                      formSnapshotId={
                        currentResponse?.formSnapshotId ?? form.formSnapshotId
                      }
                      actionId={0}
                      form={responseSchema}
                      completedFormResponse={currentResponse}
                      renderFormAsCompleted
                      onSubmit={null}
                      userId={currentResponse?.user?.id}
                      user={currentResponse?.user ?? undefined}
                      adminPreviewUserId={currentResponse?.user?.id}
                      showVariableError
                      disableOptionRandomization
                      fieldLabelRightContent={currentResponseAiInlineLabels}
                    />
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResponseReplay;
