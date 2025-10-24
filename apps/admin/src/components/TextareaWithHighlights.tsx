import { useEffect, useMemo, useRef } from "react";

export interface TextareaWithHighlightProps {
  value: string;
  onChange: (next: string) => void;
  keywords: string[];
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
  exactWord?: boolean;
  rows?: number;
  caseSensitive?: boolean;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function TextareaWithHighlight({
  value,
  onChange,
  keywords,
  placeholder,
  className = "",
  textareaClassName = "",
  exactWord = false,
  rows = 3,
  caseSensitive = false,
}: TextareaWithHighlightProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const highlightRegex = useMemo(() => {
    const parts = (keywords || [])
      .map((k) => k?.trim())
      .filter(Boolean)
      .map(escapeRegex);

    if (!parts.length) return null;

    const source = parts
      .map((p) => {
        const needsBoundary = exactWord && !/\W/.test(p);
        return needsBoundary ? `\\b(?:${p})\\b` : p;
      })
      .join("|");

    return new RegExp(`(${source})`, caseSensitive ? "g" : "gi");
  }, [keywords, exactWord, caseSensitive]);

  const highlightedHtml = useMemo(() => {
    const safe = escapeHtml(value || "");
    if (!highlightRegex) return safe;
    return safe.replace(
      highlightRegex,
      `<span class="bg-green-600/20 text-transparent">$1</span>`
    );
  }, [value, highlightRegex]);

  // Sync overlay scroll with textarea scroll.
  useEffect(() => {
    const ta = textareaRef.current;
    const ov = overlayRef.current;
    if (!ta || !ov) return;

    const onScroll = () => {
      ov.scrollTop = ta.scrollTop;
      ov.scrollLeft = ta.scrollLeft;
    };
    ta.addEventListener("scroll", onScroll, { passive: true });
    return () => ta.removeEventListener("scroll", onScroll);
  }, []);

  // Mirror key computed styles and position overlay to textarea's content box.
  useEffect(() => {
    const ta = textareaRef.current;
    const ov = overlayRef.current;
    const wrap = wrapperRef.current;
    if (!ta || !ov || !wrap) return;

    const applyComputed = () => {
      const cs = getComputedStyle(ta);

      // Position overlay inside borders (content box)
      const bt = parseFloat(cs.borderTopWidth);
      const bl = parseFloat(cs.borderLeftWidth);
      const br = parseFloat(cs.borderRightWidth);
      const bb = parseFloat(cs.borderBottomWidth);

      ov.style.top = `${bt}px`;
      ov.style.left = `${bl}px`;
      ov.style.right = `${br}px`;
      ov.style.bottom = `${bb}px`;

      // Typography/layout parity
      const propsToCopy: Array<keyof CSSStyleDeclaration> = [
        "fontFamily",
        "fontSize",
        "fontWeight",
        "fontStyle",
        "letterSpacing",
        "textIndent",
        "textTransform",
        "textAlign",
        "lineHeight",
        "tabSize",
        "whiteSpace",
        "wordBreak",
        "wordWrap",
        "overflowWrap",
        "textRendering",
      ];

      propsToCopy.forEach((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ov.style as any)[p] = (cs as any)[p];
      });

      ov.style.paddingTop = cs.paddingTop;
      ov.style.paddingRight = cs.paddingRight;
      ov.style.paddingBottom = cs.paddingBottom;
      ov.style.paddingLeft = cs.paddingLeft;

      ov.style.width = `${ta.clientWidth - (bl + br)}px`;
      ov.style.height = `${ta.clientHeight - (bt + bb)}px`;
    };

    applyComputed();

    const ro = new ResizeObserver(applyComputed);
    ro.observe(ta);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div
        ref={overlayRef}
        aria-hidden="true"
        className={[
          "absolute",
          "overflow-hidden",
          "pointer-events-none",
          "whitespace-pre-wrap",
          "break-words",
          "text-transparent",
          "will-change-transform -mx-[0.5px]",
          "rounded-lg",
        ].join(" ")}
        dangerouslySetInnerHTML={{
          __html: highlightedHtml + (value?.endsWith("\n") ? "\n" : ""),
        }}
      />

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          "w-full resize-y",
          "rounded-lg border border-zinc-300",
          "text-sm leading-6",
          "p-3",
          "overflow-auto",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          textareaClassName,
        ].join(" ")}
        spellCheck={false}
        autoComplete="off"
        rows={rows}
        autoCorrect="off"
        autoCapitalize="off"
        style={{ whiteSpace: "pre-wrap", overscrollBehaviorY: "none" }}
      />
    </div>
  );
}
