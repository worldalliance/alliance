import {
  isQuestionField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { SKIP_IF_BLOCK_ID } from "@alliance/common/forms/form-schema-validate";
import {
  ExpressionScope,
  LocalExpressionBuffers,
} from "../form-fields/conditions/expressionBuffers";
import { VisibilityConditions } from "../form-fields/conditions/VisibilityConditions";

export function SkipIfBuilder({
  schema,
  onSchemaChange,
}: {
  schema: FormSchema;
  onSchemaChange: (next: FormSchema) => void;
}) {
  const fields = schema.pages.flatMap((page) =>
    page.fields.filter(isQuestionField),
  );
  return (
    <div className="max-w-4xl mx-auto space-y-2">
      <h2 className="text-sm font-semibold text-gray-900">Skip</h2>
      <p className="text-xs text-gray-600">
        While these conditions hold, the submit button reads &ldquo;Skip this
        action&rdquo; and required fields don&apos;t block it. Submitting
        records a &ldquo;Doesn&apos;t apply to me&rdquo; withdrawal instead of a
        completion, which costs the member nothing.
      </p>
      <LocalExpressionBuffers>
        <ExpressionScope.Provider value={SKIP_IF_BLOCK_ID}>
          <VisibilityConditions
            field={{
              id: SKIP_IF_BLOCK_ID,
              visibleIfFormula: schema.skipIfFormula,
            }}
            previousFields={fields}
            onChange={({ visibleIfFormula }) =>
              onSchemaChange({ ...schema, skipIfFormula: visibleIfFormula })
            }
          />
        </ExpressionScope.Provider>
      </LocalExpressionBuffers>
    </div>
  );
}
