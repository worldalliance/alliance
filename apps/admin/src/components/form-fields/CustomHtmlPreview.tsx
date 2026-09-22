import type { CustomHtmlField } from "@alliance/common/forms/form-schema";
import { buildCustomHtmlDocument } from "@alliance/shared/forms/customHtml";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Runs the authored HTML/CSS/JS the way a member will see it, and shows the
 * answer it produces.
 *
 * Sandboxed, unlike the real web renderer, which puts the markup straight in
 * the page: a half-written script should not be able to take the form builder
 * down with it, and `allow-scripts` without `allow-same-origin` gives the
 * preview an opaque origin, so it cannot reach the admin session either.
 */
export function CustomHtmlPreview({
  field,
}: {
  field: Pick<CustomHtmlField, "html" | "css" | "js">;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);
  const [value, setValue] = useState("");

  const { html, css, js } = field;
  const document = useMemo(
    () =>
      buildCustomHtmlDocument({
        field: { html, css, js },
        initialValue: "",
        postFunction: `function (message) { parent.postMessage(message, "*"); }`,
      }),
    [html, css, js],
  );

  useEffect(() => {
    // A fresh document means a fresh answer; without this the previous run's
    // value lingers under markup that no longer produces it.
    setValue("");

    function onMessage(event: MessageEvent) {
      // Other embeds post here too, so only listen to this preview's frame.
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = event.data as {
        type?: string;
        height?: number;
        value?: string;
      };
      if (message?.type === "height") {
        const reported = Number(message.height);
        if (Number.isFinite(reported) && reported > 0) setHeight(reported);
      } else if (message?.type === "value") {
        setValue(String(message.value ?? ""));
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [document]);

  return (
    <div className="space-y-1">
      <div className="rounded border border-gray-300 bg-white p-2">
        <iframe
          ref={frameRef}
          title="Custom HTML field preview"
          sandbox="allow-scripts"
          srcDoc={document}
          className="w-full border-0 block"
          style={{ height: Math.max(height, 40) }}
        />
      </div>
      <div className="flex items-baseline gap-2 text-xs">
        <span className="text-gray-500">Answer recorded:</span>
        {value ? (
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-gray-800 break-all">
            {value}
          </code>
        ) : (
          <span className="text-amber-700">
            nothing yet — mark an element with <code>data-alliance-value</code>{" "}
            or call <code>Alliance.setValue()</code>
          </span>
        )}
      </div>
    </div>
  );
}
