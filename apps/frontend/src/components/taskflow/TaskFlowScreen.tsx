import {
  flowScreenTitle,
  missingHeaderWarning,
  type FlowScreen,
} from "@alliance/shared/forms/flowScreens";
import { draftSaveFailed, taskFlow } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { FormElements } from "@alliance/sharedweb/forms/FormElements";
import { type WebFormState } from "@alliance/sharedweb/forms/useWebFormState";
import { ModalTitle } from "@alliance/sharedweb/ui/Modal";
import { X } from "lucide-react";
import { useEffect, type ReactNode, type RefObject } from "react";
import FlowButton, { FlowButtonKind } from "./FlowButton";

export const FLOW_COLUMN = "mx-auto w-full max-w-[640px] px-4";

export function TaskFlowCloseButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <FlowButton
      kind={FlowButtonKind.Icon}
      onClick={onClick}
      disabled={disabled}
      aria-label={taskFlow.closeTask}
    >
      <X size={20} aria-hidden />
    </FlowButton>
  );
}

export function TaskFlowTitle({ children }: { children: ReactNode }) {
  return (
    <ModalTitle className="mt-2 mb-4 text-3xl text-zinc-900">
      {children}
    </ModalTitle>
  );
}

export function TaskFlowPage({
  headerEnd,
  onClose,
  closeDisabled,
  scrollRef,
  footer,
  children,
}: {
  headerEnd?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  scrollRef?: RefObject<HTMLDivElement | null>;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(FLOW_COLUMN, "flex items-center justify-between py-3")}
      >
        <TaskFlowCloseButton onClick={onClose} disabled={closeDisabled} />
        {headerEnd}
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className={cn(FLOW_COLUMN, "pb-6")}>{children}</div>
      </div>
      {footer ? (
        <div className="border-t border-zinc-100 py-3">
          <div className={cn(FLOW_COLUMN, "flex flex-col gap-y-3")}>
            {footer}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TaskFlowScreen({
  form,
  screen,
  nextReady,
  isLast,
  error,
  scrollRef,
  onClose,
  onBack,
  onNext,
}: {
  form: WebFormState;
  screen: FlowScreen;
  nextReady: boolean;
  isLast: boolean;
  error: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const title = flowScreenTitle({
    screen,
    activeUserKey: form.activeUserKey,
    isElementCurrentlyVisible: form.isElementCurrentlyVisible,
    variableValues: form.variableValues,
  });

  useEffect(() => {
    if (import.meta.env.MODE === "development" && !screen.heading) {
      console.warn(missingHeaderWarning(screen, title));
    }
  }, [screen, title]);

  return (
    <form
      ref={form.formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <TaskFlowPage
        onClose={onClose}
        closeDisabled={form.submitting}
        scrollRef={scrollRef}
        footer={
          <>
            {form.saveFailed ? (
              <p className="text-sm text-amber-600">{draftSaveFailed}</p>
            ) : null}
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <div className="flex gap-x-3">
              <FlowButton
                kind={FlowButtonKind.Secondary}
                type="button"
                className="flex-1"
                disabled={form.submitting}
                onClick={onBack}
              >
                {taskFlow.back}
              </FlowButton>
              <FlowButton
                kind={FlowButtonKind.Primary}
                type="submit"
                className={cn("flex-1", !nextReady && "opacity-50")}
                loading={form.submitting}
                disabled={form.imageUpload.uploadingAny}
              >
                {isLast ? taskFlow.submit : taskFlow.next}
              </FlowButton>
            </div>
          </>
        }
      >
        <TaskFlowTitle>{title}</TaskFlowTitle>
        <div className="space-y-6">
          <FormElements form={form} elements={screen.elements} />
        </div>
      </TaskFlowPage>
    </form>
  );
}
