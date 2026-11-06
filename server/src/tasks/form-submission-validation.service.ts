import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import { forEachCondition } from "@alliance/common/forms/form-conditions";
import {
  type FormAnswers,
  readFormAnswers,
} from "@alliance/common/forms/form-responses";
import {
  type AnyField,
  collectFieldLookup,
  FormSchema,
  type FormValue,
  isQuestionField,
  type ListField,
  type ListFieldValue,
} from "@alliance/common/forms/form-schema";
import { type FormulaChoices } from "@alliance/common/forms/formula-choices";
import { getMaxSelections } from "@alliance/common/forms/multiselect";
import {
  isEmptyRangeAnswer,
  isValidRangeSelection,
} from "@alliance/common/forms/range";
import {
  getRankingSlotCount,
  isValidRankingSelection,
} from "@alliance/common/forms/ranking";
import type { VariableSourceHistory } from "@alliance/common/forms/variable-evaluation";
import {
  type ConditionExtras,
  isElementCurrentlyVisible,
  isFieldConditionallyRequired,
  isPageCurrentlyVisible,
  listRowData,
  stripHiddenAnswers,
  visibleListSubFields,
} from "@alliance/common/forms/visibility";
import { isKnownConditionKind } from "@alliance/common/forms/visible-if-formula";
import { withCount } from "@alliance/common/plural";
import { R } from "@alliance/common/result";
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { isNull, omitBy } from "es-toolkit";
import { FormResponseQueryService } from "./form-response-query.service";
import { type FormulaSourceDto, SubmitFormDto } from "./form.dto";
import {
  checkedFormulaChoices,
  formulaSourcesOrThrow,
  loadFormulaSources,
} from "./formula-sources";
import { MemberVisibilityService } from "./member-visibility.service";

export function parseSubmittedAnswers(
  value: Record<string, unknown>,
): FormAnswers {
  const answers = readFormAnswers(omitBy(value, isNull));
  if (R.isFailure(answers)) {
    throw new BadRequestException("Answers are not a valid answer map");
  }
  return answers.value;
}

export function readListAnswer(
  field: ListField,
  value: FormValue | undefined,
): ListFieldValue {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException(
      `Field ${elementInternalDescriptor(field)} is not a list.`,
    );
  }
  return value.map((item, i) => {
    if (typeof item !== "object") {
      throw new BadRequestException(
        `Field ${elementInternalDescriptor(field)} (item ${i + 1}) is not a list item.`,
      );
    }
    return item;
  });
}

@Injectable()
export class FormSubmissionValidationService {
  constructor(
    private readonly formResponseQueryService: FormResponseQueryService,
    private readonly memberVisibilityService: MemberVisibilityService,
  ) {}

  /** Returns true if value satisfies required validation for the field. Used for both top-level and list sub-field validation. */
  private hasRequiredValue(field: AnyField, value: unknown): boolean {
    if (field.kind === "contract") {
      return value !== undefined;
    }
    if (value === undefined || value === null) {
      return false;
    }
    if (field.kind === "number" || field.kind === "range") {
      return typeof value === "number" && Number.isFinite(value);
    }
    if (field.kind === "checkbox") {
      return value === true;
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return true;
  }

  private hasInvalidRangeAnswer(field: AnyField, value: unknown): boolean {
    return (
      field.kind === "range" &&
      !isEmptyRangeAnswer(value) &&
      !isValidRangeSelection(field, value)
    );
  }

  /**
   * Throws unless every condition in the schema is one this build can
   * evaluate. `evaluateCondition` reports an unknown kind as "not met" so that
   * older clients degrade instead of crashing mid-render; the server can't
   * take that answer, since "not met" silently strips the answers the
   * condition gates.
   */
  private assertConditionKindsSupported(schema: FormSchema): void {
    forEachCondition(schema, (condition) => {
      if (!isKnownConditionKind(condition.kind)) {
        throw new InternalServerErrorException(
          `Form schema uses an unsupported condition kind: ${condition.kind}`,
        );
      }
    });
  }

  async validateFormSubmission({
    schema,
    submitFormDto,
    userId,
  }: {
    // The schema the user submitted against
    schema: FormSchema;
    submitFormDto: SubmitFormDto;
    userId: number;
  }): Promise<{
    validatorResults: Record<number, boolean>;
    /**
     * The submitted answers with entries for hidden fields removed — the
     * client strips them too, but the server never trusts that. Validate
     * against, extract from, and persist these, never the raw dto answers.
     */
    effectiveAnswers: Record<string, FormValue>;
    formulaChoices: FormulaChoices;
  }> {
    const answers = parseSubmittedAnswers(submitFormDto.answers);

    // A stored snapshot can outlive the server that wrote it (a rollback, a
    // mid-deploy instance). Evaluating a kind we don't know would strip the
    // answers it gates instead of erroring, so refuse the submission whole.
    this.assertConditionKindsSupported(schema);

    const memberExtras = await this.memberVisibilityService.memberExtras({
      schema,
      userId,
    });
    const validatorResults = memberExtras.visibilityValidatorResults;

    const fieldLookup = collectFieldLookup(schema.pages);

    const visibilityExtras: ConditionExtras = {
      ...memberExtras,
      deviceType: submitFormDto.deviceType,
      fieldLookup,
    };

    const effectiveAnswers = stripHiddenAnswers(
      schema.pages,
      answers,
      visibilityExtras,
    );

    for (const page of schema.pages) {
      if (!isPageCurrentlyVisible(page, effectiveAnswers, visibilityExtras)) {
        // Fields on a hidden page are never shown, so their requirements
        // don't apply.
        continue;
      }
      for (const field of page.fields) {
        if (isQuestionField(field)) {
          const required = isFieldConditionallyRequired(
            field,
            effectiveAnswers,
            visibilityExtras,
          );
          if (
            required &&
            isElementCurrentlyVisible(field, effectiveAnswers, visibilityExtras)
          ) {
            if (!this.hasRequiredValue(field, effectiveAnswers[field.id])) {
              throw new BadRequestException(
                `Field ${elementInternalDescriptor(field)} is required`,
              );
            }
          }
          const maxSelections =
            field.kind === "multiselect" ? getMaxSelections(field) : undefined;
          if (
            maxSelections !== undefined &&
            isElementCurrentlyVisible(field, effectiveAnswers, visibilityExtras)
          ) {
            const answer = effectiveAnswers[field.id];
            if (Array.isArray(answer) && answer.length > maxSelections) {
              throw new BadRequestException(
                `Field ${elementInternalDescriptor(field)} allows selecting up to ${withCount(maxSelections, "option")}.`,
              );
            }
          }
          if (
            this.hasInvalidRangeAnswer(field, effectiveAnswers[field.id]) &&
            isElementCurrentlyVisible(field, effectiveAnswers, visibilityExtras)
          ) {
            throw new BadRequestException(
              `Field ${elementInternalDescriptor(field)} has an answer outside its options.`,
            );
          }
          if (
            field.kind === "ranking" &&
            isElementCurrentlyVisible(field, effectiveAnswers, visibilityExtras)
          ) {
            const answer = effectiveAnswers[field.id];
            if (
              answer !== undefined &&
              answer !== null &&
              !isValidRankingSelection(field, answer)
            ) {
              throw new BadRequestException(
                `Field ${elementInternalDescriptor(field)} has an invalid ranking.`,
              );
            }
            const slotCount = getRankingSlotCount(field);
            if (
              required &&
              (!Array.isArray(answer) || answer.length < slotCount)
            ) {
              throw new BadRequestException(
                `Field ${elementInternalDescriptor(field)} requires ranking ${withCount(slotCount, "item")}.`,
              );
            }
          }
          if (field.kind === "list") {
            const listField = field as ListField;
            if (
              !isElementCurrentlyVisible(
                listField,
                effectiveAnswers,
                visibilityExtras,
              )
            ) {
              continue;
            }
            const listValue = readListAnswer(
              listField,
              effectiveAnswers[listField.id],
            );
            const minCards = Math.max(
              0,
              Math.floor(Number(listField.min ?? 0)),
            );
            const maxCards =
              typeof listField.max === "number" && listField.max >= 0
                ? Math.floor(listField.max)
                : Infinity;
            if (required && listValue.length === 0) {
              throw new BadRequestException(
                `Field ${elementInternalDescriptor(listField)} requires at least one item.`,
              );
            }
            if (listValue.length < minCards) {
              throw new BadRequestException(
                `Field ${elementInternalDescriptor(listField)}: add at least ${withCount(minCards, "item")}.`,
              );
            }
            if (listValue.length > maxCards) {
              throw new BadRequestException(
                `Field ${elementInternalDescriptor(listField)}: add no more than ${withCount(maxCards, "item")}.`,
              );
            }
            const subFields = listField.fields ?? [];
            for (let i = 0; i < listValue.length; i += 1) {
              const card = listValue[i] ?? {};
              const mergedData = listRowData({
                data: effectiveAnswers,
                row: card,
              });
              for (const sub of visibleListSubFields({
                subFields,
                data: effectiveAnswers,
                row: card,
                extras: visibilityExtras,
              })) {
                if (!isQuestionField(sub)) {
                  continue;
                }
                const subValue = card[sub.id];
                if (this.hasInvalidRangeAnswer(sub, subValue)) {
                  throw new BadRequestException(
                    `Field ${elementInternalDescriptor(listField)} (item ${i + 1}): ${elementInternalDescriptor(sub)} has an answer outside its options.`,
                  );
                }
                if (
                  !isFieldConditionallyRequired(
                    sub,
                    mergedData,
                    visibilityExtras,
                  )
                ) {
                  continue;
                }
                if (!this.hasRequiredValue(sub, subValue)) {
                  throw new BadRequestException(
                    `Field ${elementInternalDescriptor(listField)} (item ${i + 1}): ${elementInternalDescriptor(sub)} is required.`,
                  );
                }
              }
            }
          }
        }
      }
    }

    const formulaChoices = await checkedFormulaChoices({
      schema,
      answers: effectiveAnswers,
      loadSources: () =>
        this.submittedFormulaSources({
          schema,
          userId,
          sent: submitFormDto.formulaSources,
        }),
    });

    return { validatorResults, effectiveAnswers, formulaChoices };
  }

  /**
   * The histories the submitting form's options formulas read, as it read
   * them.
   */
  private async submittedFormulaSources(params: {
    schema: FormSchema;
    userId: number;
    sent: FormulaSourceDto[] | undefined;
  }): Promise<ReadonlyMap<number, VariableSourceHistory>> {
    return formulaSourcesOrThrow(
      await loadFormulaSources({
        schema: params.schema,
        sent: params.sent,
        loadHistory: this.formResponseQueryService.formulaSourceHistoryLoader(
          params.userId,
        ),
      }),
    );
  }
}
