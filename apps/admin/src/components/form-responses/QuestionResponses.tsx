import type { AnyField } from "@alliance/common/forms/form-schema";
import type {
  ActionWithdrawalDto,
  FormResponseDto,
} from "@alliance/shared/client";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Card from "@alliance/sharedweb/ui/Card";
import React, { useCallback, useMemo } from "react";
import { AI_SCORE_FIELD_KINDS, formatAiScore } from "../../lib/aiScore";
import { formatAnswerValue, isEmptyAnswer } from "../../lib/answerValues";
import { choiceAnswerText } from "../../lib/questionAnswer";
import { IdentityChip } from "../IdentitySwatch";
import { WithdrawalBadge } from "../WithdrawalInfo";

type QuestionResponsesProps = {
  loading: boolean;
  error: string | null;
  responses: FormResponseDto[];
  orderedFieldIds: string[];
  fieldLabels: Map<string, string>;
  fieldsById: Map<string, AnyField>;
  selectedQuestionFieldId: string;
  onSelectQuestionField: (fieldId: string) => void;
  getResponseVariantName: (response: FormResponseDto) => string | null;
  getRespondentName: (response: FormResponseDto) => string;
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
};

const QuestionResponses: React.FC<QuestionResponsesProps> = ({
  loading,
  error,
  responses,
  orderedFieldIds,
  fieldLabels,
  fieldsById,
  selectedQuestionFieldId,
  onSelectQuestionField,
  getResponseVariantName,
  getRespondentName,
  withdrawnUserMap,
}) => {
  const selectedQuestionField = useMemo(
    () => fieldsById.get(selectedQuestionFieldId),
    [fieldsById, selectedQuestionFieldId],
  );

  const questionResponses = useMemo(() => {
    if (!selectedQuestionFieldId) return [];
    return responses.filter(
      (response) => !isEmptyAnswer(response.answers?.[selectedQuestionFieldId]),
    );
  }, [responses, selectedQuestionFieldId]);

  const formatSelectedQuestionAnswer = useCallback(
    (value: unknown, response: FormResponseDto): string =>
      (selectedQuestionField &&
        choiceAnswerText({ field: selectedQuestionField, value, response })) ??
      formatAnswerValue(value),
    [selectedQuestionField],
  );

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
      ) : orderedFieldIds.length === 0 ? (
        <Card style={CardStyle.White}>
          <p className="text-gray-600">No answerable questions found.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 mt-3">
            <label
              htmlFor="question-field-select"
              className="text-xs font-semibold tracking-wide text-gray-600 uppercase"
            >
              Question
            </label>
            <select
              id="question-field-select"
              value={selectedQuestionFieldId}
              onChange={(event) => onSelectQuestionField(event.target.value)}
              className="w-full max-w-xl rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
            >
              {orderedFieldIds.map((fieldId) => (
                <option key={fieldId} value={fieldId}>
                  {fieldLabels.get(fieldId) ?? fieldId}
                </option>
              ))}
            </select>
          </div>

          {questionResponses.length === 0 ? (
            <Card style={CardStyle.White}>
              <p className="text-gray-600">
                No users responded to this question.
              </p>
            </Card>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="grid grid-cols-1 gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold tracking-wide text-gray-600 uppercase md:grid-cols-[260px_minmax(0,1fr)_auto]">
                <div>Respondent</div>
                <div>Answer</div>
                {selectedQuestionField &&
                  AI_SCORE_FIELD_KINDS.has(selectedQuestionField.kind) && (
                    <div>AI Score</div>
                  )}
              </div>
              {questionResponses.map((response, index) => {
                const answerValue = selectedQuestionFieldId
                  ? response.answers?.[selectedQuestionFieldId]
                  : null;
                const variantName = getResponseVariantName(response);
                const aiDetection =
                  selectedQuestionField &&
                  AI_SCORE_FIELD_KINDS.has(selectedQuestionField.kind)
                    ? (response.aiDetectionResults ?? []).find(
                        (d) =>
                          d.fieldPath === `answers.${selectedQuestionFieldId}`,
                      )
                    : null;
                return (
                  <div
                    key={
                      response.id ??
                      `${response.sid ?? "anonymous"}-${
                        response.createdAt
                      }-${index}`
                    }
                    className={cn(
                      "grid grid-cols-1 gap-1 border-b border-gray-100 px-3 py-2 last:border-b-0 md:gap-3",
                      selectedQuestionField &&
                        AI_SCORE_FIELD_KINDS.has(selectedQuestionField.kind)
                        ? "md:grid-cols-[260px_minmax(0,1fr)_auto]"
                        : "md:grid-cols-[260px_minmax(0,1fr)]",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {getRespondentName(response)}
                        </p>
                        {variantName && (
                          <IdentityChip
                            seed={variantName}
                            label={variantName}
                            className="shrink-0"
                          />
                        )}
                        {response.user?.id != null &&
                          withdrawnUserMap.has(response.user.id) && (
                            <WithdrawalBadge className="shrink-0" />
                          )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(response.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-5">
                        {formatSelectedQuestionAnswer(answerValue, response)}
                      </p>
                    </div>
                    {selectedQuestionField &&
                      AI_SCORE_FIELD_KINDS.has(selectedQuestionField.kind) && (
                        <div className="flex items-start">
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              aiDetection &&
                                typeof aiDetection.aiProbability === "number" &&
                                aiDetection.aiProbability > 0
                                ? "text-red-600"
                                : "text-gray-400",
                            )}
                          >
                            {formatAiScore(aiDetection?.aiProbability ?? null)}
                          </span>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionResponses;
