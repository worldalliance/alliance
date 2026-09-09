import { type ComponentType } from "react";
import { FormMode, formMode } from "./formMode";
import { PreviewModeProvider } from "./previewMode";

type FormModeProps = {
  renderFormAsCompleted?: boolean;
  previewMode?: boolean;
  onSubmit: unknown;
};

type InnerProps<P extends FormModeProps> = Omit<
  P,
  "renderFormAsCompleted" | "previewMode"
> & { mode: FormMode };

/**
 * Going live remounts rather than clearing state. Every path that fills a live
 * form runs on mount and nowhere else, so a reset in place would leave behind
 * whichever one it forgot to name.
 */
export function withFormMode<P extends FormModeProps>(
  Inner: ComponentType<InnerProps<P>>,
) {
  return function FormRenderer(props: P) {
    const { renderFormAsCompleted, previewMode, ...rest } = props;
    const mode = formMode({
      renderFormAsCompleted,
      hasSubmit: !!props.onSubmit,
      previewMode,
    });
    const preview = mode === FormMode.Preview;
    return (
      <PreviewModeProvider value={preview}>
        <Inner key={preview ? "preview" : "live"} {...rest} mode={mode} />
      </PreviewModeProvider>
    );
  };
}
