import type { CustomHtmlField as CustomHtmlFieldSchema } from "@alliance/common/forms/form-schema";
import {
  CUSTOM_HTML_SCOPE_ATTRIBUTE,
  customHtmlRuntimeSource,
  scopeCustomCss,
  wrapAuthoredScript,
} from "@alliance/shared/forms/customHtml";
import { useEffect, useId, useRef } from "react";

type Props = {
  field: CustomHtmlFieldSchema;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
};

/**
 * Renders a `customhtml` field's authored markup inline in the page.
 *
 * Inline rather than in an iframe is deliberate: authored scripts are written
 * against `document` and expect to sit in the page, the way the `html` display
 * block already does. It also means the CSS has to be scoped for them — see
 * `scopeCustomCss` — and that the script runs with the app's privileges, so
 * this is only as safe as the set of people who can edit forms.
 */
export default function CustomHtmlField({
  field,
  value,
  onChange,
  disabled,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scopeId = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  // The effect below must not re-run when the answer or the handler changes —
  // re-running would tear down a widget mid-interaction — so both reach it
  // through refs instead of the dependency list.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const { html, css, js } = field;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.innerHTML = html;

    const scope = `[${CUSTOM_HTML_SCOPE_ATTRIBUTE}="${scopeId}"]`;
    const style = document.createElement("style");
    style.textContent = scopeCustomCss(css ?? "", scope);
    root.prepend(style);

    const source = `
      ${customHtmlRuntimeSource({
        rootExpression: "__ROOT__",
        initialValueExpression: "__INITIAL__",
        publishFunction: "__PUBLISH__",
      })}
      ${wrapAuthoredScript(js)}
      return __runDestroy;
    `;

    let destroy: (() => void) | undefined;
    try {
      const run = new Function(
        "__ROOT__",
        "__INITIAL__",
        "__PUBLISH__",
        source,
      );
      destroy = run(root, valueRef.current ?? "", (next: string) =>
        onChangeRef.current?.(next),
      ) as () => void;
    } catch (error) {
      // A syntax error in authored JS must not take the form down with it.
      console.error("[custom html field] failed to initialize:", error);
    }

    return () => {
      destroy?.();
      root.innerHTML = "";
    };
    // Re-mounting on an edit is what makes the builder preview live.
  }, [html, css, js, scopeId]);

  return (
    <div
      ref={rootRef}
      {...{ [CUSTOM_HTML_SCOPE_ATTRIBUTE]: scopeId }}
      // Authored markup owns its own interactivity, so disabling the field is
      // the one thing the host can do to it from outside.
      inert={disabled || undefined}
      style={disabled ? { opacity: 0.6 } : undefined}
    />
  );
}
