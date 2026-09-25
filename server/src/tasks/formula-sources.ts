import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import {
  asCards,
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import {
  collectOptionsFormulaFields,
  FORMULA_SOURCES_CHANGED,
  optionsFormulaSourceFormIds,
  resolveFormulaOptions,
  selectedFormulaChoices,
  selectsFormulaChoice,
  type FormulaChoices,
  type FormulaFieldEntry,
} from "@alliance/common/forms/formula-options";
import type { VariableSourceHistory } from "@alliance/common/forms/variable-evaluation";
import {
  EMPTY_HISTORY,
  readSourceHistory,
} from "@alliance/common/forms/variable-source-history";
import { R, type Result } from "@alliance/common/result";
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import { isEqual } from "es-toolkit";
import z from "zod";
import type { FormResponseHistory } from "./form-response-history.dto";
import type { FormulaSourceDto } from "./form.dto";

enum FormulaSourceRefusal {
  /** The submission doesn't name the responses the form read. */
  Missing = "missing",
  /** The member's history no longer starts with the responses the form read. */
  Changed = "changed",
  Unreadable = "unreadable",
}

type FormulaSourceFailure =
  | { refusal: FormulaSourceRefusal.Missing | FormulaSourceRefusal.Changed }
  | { refusal: FormulaSourceRefusal.Unreadable; cause: Error };

/** A withdrawal's body isn't validated, so its formula sources are read here. */
const sentFormulaSourcesSchema = z.array(
  z.object({
    formId: z.number().int(),
    responseIds: z.array(z.number().int()),
  }),
);

/**
 * The history an open form read, as long as the member's history still starts
 * with exactly those responses. Responses submitted since are left out, so a
 * new submission can't change what the form offered. The client names that
 * prefix, so a choice is checked against some earlier state of the member's
 * own history, not necessarily the current one.
 */
function verifiedFormulaSource(params: {
  history: FormResponseHistory;
  sent: FormulaSourceDto;
}): Result<VariableSourceHistory, FormulaSourceFailure> {
  const { history, sent } = params;
  const read = history.responses.slice(0, sent.responseIds.length);
  if (
    !isEqual(
      read.map(({ id }) => id),
      sent.responseIds,
    )
  ) {
    return R.failure({ refusal: FormulaSourceRefusal.Changed });
  }
  return R.mapError(
    readSourceHistory({
      schema: history.form.formSnapshot.schema,
      responses: read.map((response) => ({
        id: response.id,
        answers: response.answers,
        schemaSnapshot: response.formSnapshot.schema,
        formulaChoices: response.formulaChoices,
      })),
    }),
    (cause) => ({ refusal: FormulaSourceRefusal.Unreadable, cause }),
  );
}

type LoadedFormulaSources = Result<
  ReadonlyMap<number, VariableSourceHistory>,
  FormulaSourceFailure & { formId: number }
>;

export async function loadFormulaSources(params: {
  schema: FormSchema;
  sent: readonly FormulaSourceDto[] | undefined;
  loadHistory: (formId: number) => Promise<FormResponseHistory | undefined>;
}): Promise<LoadedFormulaSources> {
  const { schema, sent, loadHistory } = params;
  const sources = new Map<number, VariableSourceHistory>();
  for (const formId of optionsFormulaSourceFormIds(schema)) {
    const read = sent?.find((source) => source.formId === formId);
    if (read === undefined) {
      return R.failure({ refusal: FormulaSourceRefusal.Missing, formId });
    }
    const history = await loadHistory(formId);
    if (history === undefined) {
      return R.failure({ refusal: FormulaSourceRefusal.Changed, formId });
    }
    const verified = verifiedFormulaSource({ history, sent: read });
    if (!verified.ok) return R.failure({ ...verified.error, formId });
    sources.set(formId, verified.value);
  }
  return R.success(sources);
}

/**
 * A history that can't be matched to what the form read refuses the
 * submission rather than check it against the current one.
 */
export function formulaSourcesOrThrow(
  loaded: LoadedFormulaSources,
): ReadonlyMap<number, VariableSourceHistory> {
  if (loaded.ok) return loaded.value;
  const failure = loaded.error;
  switch (failure.refusal) {
    case FormulaSourceRefusal.Missing:
      throw new BadRequestException(
        `Form submission is missing the responses its options read from form ${failure.formId}`,
      );
    case FormulaSourceRefusal.Changed:
      throw new ConflictException(FORMULA_SOURCES_CHANGED);
    case FormulaSourceRefusal.Unreadable:
      throw new InternalServerErrorException(
        `Can't read your responses to form ${failure.formId}, which this form's options read: ${failure.cause.message}`,
      );
    default:
      throw new Error(
        `unknown formula source refusal: ${failure satisfies never}`,
      );
  }
}

function formulaChoicesOrThrow(
  choices: Result<FormulaChoices, string>,
): FormulaChoices {
  if (!choices.ok) throw new BadRequestException(choices.error);
  return choices.value;
}

/**
 * Builds that predate formula options send no sources, and answers without a
 * formula choice have nothing for them to check, so only answers selecting
 * one load the sources and are checked.
 */
export async function checkedFormulaChoices(params: {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  loadSources: () => Promise<ReadonlyMap<number, VariableSourceHistory>>;
}): Promise<FormulaChoices> {
  const { schema, answers, loadSources } = params;
  if (!selectsFormulaChoice(schema, answers)) return {};
  return formulaChoicesOrThrow(
    submittedFormulaChoices({ schema, answers, sources: await loadSources() }),
  );
}

/**
 * A withdrawal is saved unchecked, so one whose sources don't load saves no
 * labels. Like a submission, one whose formulas read no other form needs to
 * name none.
 */
export async function withdrawalFormulaSources(params: {
  schema: FormSchema;
  sent: unknown;
  loadHistory: (formId: number) => Promise<FormResponseHistory | undefined>;
}): Promise<ReadonlyMap<number, VariableSourceHistory> | undefined> {
  const sent = sentFormulaSourcesSchema.safeParse(params.sent ?? []);
  if (!sent.success) return undefined;
  const loaded = await loadFormulaSources({ ...params, sent: sent.data });
  return loaded.ok ? loaded.value : undefined;
}

/** A guest has no submissions to read. */
export function guestFormulaSources(
  schema: FormSchema,
): ReadonlyMap<number, VariableSourceHistory> {
  return new Map(
    optionsFormulaSourceFormIds(schema).map((formId) => [
      formId,
      EMPTY_HISTORY,
    ]),
  );
}

/**
 * The choices each options formula offered that the answers selected, or why
 * the answers can't be saved: the formula fails, or an answer holds a choice
 * it doesn't offer.
 */
export function submittedFormulaChoices(params: {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  sources: ReadonlyMap<number, VariableSourceHistory>;
}): Result<FormulaChoices, string> {
  const { schema, answers } = params;
  const resolved = resolveFormulaOptions(params);
  if (!resolved.ok) return resolved;
  const fieldAnswers = (
    all: Record<string, FormValue>,
    { field, listId }: FormulaFieldEntry,
  ) =>
    listId === undefined
      ? all[field.id]
      : asCards(all[listId])?.map((row) => row[field.id]);
  const unoffered = collectOptionsFormulaFields(schema).find(
    (entry) =>
      !isEqual(
        fieldAnswers(resolved.value.answers, entry),
        fieldAnswers(answers, entry),
      ),
  );
  if (unoffered !== undefined) {
    return R.failure(
      `Field ${elementInternalDescriptor(unoffered.field)} has a choice its options don't offer`,
    );
  }
  return R.success(
    selectedFormulaChoices({
      schema,
      answers,
      options: resolved.value.options,
    }),
  );
}

/**
 * The labels a withdrawal's answers select, where its formulas resolve. A
 * withdrawal is saved unchecked, so an unmatched history or a failing formula
 * leaves them out rather than refusing it.
 */
export async function withdrawnFormulaChoices(params: {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  loadSources: () => Promise<
    ReadonlyMap<number, VariableSourceHistory> | undefined
  >;
}): Promise<FormulaChoices> {
  const { schema, answers, loadSources } = params;
  if (!selectsFormulaChoice(schema, answers)) return {};
  const sources = await loadSources();
  if (sources === undefined) return {};
  const resolved = resolveFormulaOptions({ schema, answers, sources });
  return resolved.ok
    ? selectedFormulaChoices({
        schema,
        answers,
        options: resolved.value.options,
      })
    : {};
}
