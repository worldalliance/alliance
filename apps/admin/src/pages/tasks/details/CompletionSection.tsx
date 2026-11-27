import {
  inPartitionedSuite,
  suiteKindUnknown,
} from "../../../lib/actionFieldDefs";
import { CheckboxField, FormSection } from "../../../ui/templates/Form";
import type { DetailsSectionProps } from "./detailsRules";

export function CompletionSection({
  editor,
  lookups,
}: Omit<DetailsSectionProps, "task">) {
  const { form } = editor;
  // A suite's parts set optional work, and the server sets the flag of a task
  // moved into one from them.
  const kindUnknown = suiteKindUnknown(
    { loading: lookups.suitesLoading, failed: lookups.suitesError },
    form.suiteId,
  );
  const partitioned = inPartitionedSuite(
    lookups.availableSuites ?? [],
    form.suiteId,
  );
  return (
    <FormSection title="Completion" description="How members finish the task.">
      <CheckboxField
        name="optional"
        label="Optional"
        help={
          kindUnknown
            ? lookups.suitesError
              ? "Can't be changed until suites load. Reload the page."
              : "Editable once suites load, since a partitioned suite sets it."
            : partitioned
              ? "Set by the suite's partition."
              : "Shows a prominent dismiss option above the task card."
        }
        disabled={kindUnknown || partitioned}
        checked={form.optional ?? false}
        onChange={editor.handleInputChange}
      />
      <CheckboxField
        name="shouldCompleteAfterDeadline"
        label="Complete after deadline"
        help="Lets members still complete it after the deadline passes, and keeps it in their tasks view."
        checked={form.shouldCompleteAfterDeadline ?? false}
        onChange={editor.handleInputChange}
      />
      <CheckboxField
        name="preventCompletion"
        label="Prevent completion"
        help="Stops members from completing the task, even on its page."
        checked={form.preventCompletion ?? false}
        onChange={editor.handleInputChange}
      />
    </FormSection>
  );
}
