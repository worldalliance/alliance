import { R, type Result } from "../result";
import { readStoredFormAnswers } from "./form-responses";
import { variableInputFieldsById } from "./form-schema";
import { storedQuestionFields, submittedQuestionFields } from "./stored-schema";
import type { VariableSourceHistory } from "./variable-evaluation";

export type StoredSourceHistory = {
  /** The source form's current schema. */
  schema: unknown;
  /** Submitted responses, oldest first. */
  responses: readonly {
    id: number;
    answers: unknown;
    schemaSnapshot: unknown;
  }[];
};

/** Fails whole when any answer or form version can't be read. */
export function readSourceHistory(
  stored: StoredSourceHistory,
): Result<VariableSourceHistory, Error> {
  return R.fromThrowable(() => {
    const current = R.unwrap(storedQuestionFields(stored.schema));
    return {
      fields: variableInputFieldsById(current),
      responses: stored.responses.map((response) => {
        const unreadable = `Can't read response ${response.id}`;
        return {
          id: response.id,
          answers: R.expect(
            readStoredFormAnswers(response.answers),
            unreadable,
          ),
          fields: variableInputFieldsById(
            R.expect(
              submittedQuestionFields({
                snapshot: response.schemaSnapshot,
                current,
              }),
              unreadable,
            ),
          ),
        };
      }),
    };
  });
}
