import type { AnyField } from "@alliance/common/forms/form-schema";
import type {
  ActionWithdrawalDto,
  FormResponseDto,
} from "@alliance/shared/client";
import React, { useId, useMemo } from "react";
import { AI_SCORE_FIELD_KINDS, formatAiScore } from "../../lib/aiScore";
import { formatAnswerValue, isEmptyAnswer } from "../../lib/answerValues";
import { formatDateTime } from "../../lib/formatDate";
import { countOf } from "../../lib/formatNumber";
import { choiceAnswerText } from "../../lib/questionAnswer";
import { cn } from "../../ui/cn";
import { Select } from "../../ui/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { FilterBar } from "../../ui/templates/List";
import { ContentState, TableSkeleton } from "../../ui/templates/States";
import { IdentityChip } from "../IdentitySwatch";
import { WithdrawalInfo } from "../WithdrawalInfo";

type QuestionResponsesProps = {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
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

// An answer runs to several lines, so every cell of its row starts at the top.
const CELL = "py-2.5 align-top";
const ANSWER_CELL = `${CELL} w-full`;
const SCORE_CELL = `${CELL} text-right tabular-nums`;

const QuestionResponses: React.FC<QuestionResponsesProps> = ({
  loading,
  error,
  onRetry,
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
  const selectId = useId();
  const field = fieldsById.get(selectedQuestionFieldId);
  const scored = field !== undefined && AI_SCORE_FIELD_KINDS.has(field.kind);

  const answered = useMemo(() => {
    if (!selectedQuestionFieldId) return [];
    return responses.filter(
      (response) => !isEmptyAnswer(response.answers?.[selectedQuestionFieldId]),
    );
  }, [responses, selectedQuestionFieldId]);

  const ready = !loading && !error;
  const noQuestions = ready && orderedFieldIds.length === 0;

  return (
    <>
      <FilterBar
        count={
          ready && answered.length > 0
            ? countOf(answered.length, "answer")
            : undefined
        }
      >
        <label htmlFor={selectId} className="font-medium">
          Question
        </label>
        <Select
          id={selectId}
          className="h-control-sm w-96 max-w-full"
          value={selectedQuestionFieldId}
          disabled={orderedFieldIds.length === 0}
          onChange={(event) => onSelectQuestionField(event.target.value)}
        >
          {orderedFieldIds.map((fieldId) => (
            <option key={fieldId} value={fieldId}>
              {fieldLabels.get(fieldId) ?? fieldId}
            </option>
          ))}
        </Select>
      </FilterBar>
      <ContentState
        loading={loading}
        skeleton={<TableSkeleton bleed columns={3} />}
        error={error}
        errorTitle="Couldn't load responses"
        onRetry={onRetry}
        empty={noQuestions || answered.length === 0}
        emptyTitle={
          noQuestions
            ? "No answerable questions"
            : "No answers to this question"
        }
        emptyDescription={
          noQuestions
            ? "This form has no question whose answers can be listed here."
            : undefined
        }
      >
        <Table bleed>
          <TableHeader>
            <TableRow>
              <TableHead>Respondent</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="w-full">Answer</TableHead>
              {scored && <TableHead className="text-right">AI score</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {answered.map((response, index) => {
              const value = response.answers?.[selectedQuestionFieldId];
              const variantName = getResponseVariantName(response);
              const withdrawal =
                response.user?.id != null
                  ? withdrawnUserMap.get(response.user.id)
                  : undefined;
              const aiProbability = (response.aiDetectionResults ?? []).find(
                (detection) =>
                  detection.fieldPath === `answers.${selectedQuestionFieldId}`,
              )?.aiProbability;
              const name = getRespondentName(response);
              return (
                <TableRow
                  key={
                    response.id ??
                    `${response.sid ?? "anonymous"}-${response.createdAt}-${index}`
                  }
                >
                  <TableCell className={CELL}>
                    <span className="flex items-center gap-2">
                      <span
                        className="max-w-64 truncate font-medium"
                        title={name}
                      >
                        {name}
                      </span>
                      {variantName && (
                        <IdentityChip seed={variantName} label={variantName} />
                      )}
                      {withdrawal && <WithdrawalInfo withdrawal={withdrawal} />}
                    </span>
                  </TableCell>
                  <TableCell
                    className={`${CELL} whitespace-nowrap text-fg-muted`}
                  >
                    {formatDateTime(response.createdAt)}
                  </TableCell>
                  <TableCell className={ANSWER_CELL}>
                    <p className="max-w-prose wrap-break-word whitespace-pre-wrap">
                      {(field &&
                        choiceAnswerText({ field, value, response })) ??
                        formatAnswerValue(value)}
                    </p>
                  </TableCell>
                  {scored && (
                    <TableCell
                      className={cn(
                        SCORE_CELL,
                        (aiProbability ?? 0) > 0 && "font-medium text-danger",
                      )}
                    >
                      {formatAiScore(aiProbability ?? null)}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ContentState>
    </>
  );
};

export default QuestionResponses;
