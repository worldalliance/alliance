import { type PageItem } from "@alliance/common/forms/form-schema";
import { splitBackground } from "@alliance/shared/forms/flowScreens";
import { taskFlow } from "@alliance/shared/lib/copy";
import { FormElements } from "@alliance/sharedweb/forms/FormElements";
import { type WebFormState } from "@alliance/sharedweb/forms/useWebFormState";
import { ArrowRight, Check } from "lucide-react";
import FlowButton, { FlowButtonKind } from "./FlowButton";
import { TaskFlowPage, TaskFlowTitle } from "./TaskFlowScreen";

export default function TaskFlowIntro({
  form,
  background,
  onNext,
  nextLabel,
  nextIsLast,
  error,
}: {
  form: WebFormState;
  /** The form's opening content, which asks for nothing. */
  background: PageItem[];
  onNext: () => void;
  nextLabel: string;
  nextIsLast: boolean;
  error: string | null;
}) {
  const { media, reading } = splitBackground(background);

  return (
    <TaskFlowPage
      footer={
        <>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <FlowButton
            kind={FlowButtonKind.Primary}
            className="w-full"
            loading={form.submitting}
            onClick={onNext}
            iconRight={nextIsLast ? Check : ArrowRight}
          >
            {nextLabel}
          </FlowButton>
        </>
      }
    >
      <TaskFlowTitle>{taskFlow.background}</TaskFlowTitle>

      {media.length > 0 ? (
        <div className="mb-6 space-y-6">
          <FormElements form={form} elements={media} />
        </div>
      ) : null}

      <div className="space-y-6">
        <FormElements form={form} elements={reading} />
      </div>
    </TaskFlowPage>
  );
}
