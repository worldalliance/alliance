import { cn } from "@alliance/shared/styles/util";
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
  editable?: boolean;
  highlightHashPipeSyntax?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onClick?: React.MouseEventHandler<HTMLTextAreaElement>;
  onDrop?: React.DragEventHandler<HTMLTextAreaElement>;
  onDragOver?: React.DragEventHandler<HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const HASH_PIPE_SYNTAX_REGEX = /#\{[^}|]*\|[^}]*\}/g;

export default function TextareaWithHighlight({
  value,
  onChange,
  keywords,
  placeholder,
  className = "",
  textareaClassName = "",
  exactWord = false,
  rows = 4,
  caseSensitive = false,
  editable = true,
  highlightHashPipeSyntax = false,
  textareaRef,
  onClick,
  onDrop,
  onDragOver,
  onKeyDown,
  onKeyUp,
}: TextareaWithHighlightProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const internalTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const resolvedTextareaRef = textareaRef ?? internalTextareaRef;

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

    const afterHashPipe = highlightHashPipeSyntax
      ? safe.replace(
          HASH_PIPE_SYNTAX_REGEX,
          '<span class="bg-amber-400/20 text-transparent">$&</span>'
        )
      : safe;

    if (!highlightRegex) return afterHashPipe;
    return afterHashPipe.replace(
      highlightRegex,
      `<span class="bg-green/20 text-transparent">$1</span>`
    );
  }, [value, highlightRegex, highlightHashPipeSyntax]);

  // Sync overlay scroll with textarea scroll.
  useEffect(() => {
    const ta = resolvedTextareaRef.current;
    const ov = overlayRef.current;
    if (!ta || !ov) return;

    const onScroll = () => {
      ov.scrollTop = ta.scrollTop;
      ov.scrollLeft = ta.scrollLeft;
    };
    ta.addEventListener("scroll", onScroll, { passive: true });
    return () => ta.removeEventListener("scroll", onScroll);
  }, [resolvedTextareaRef]);

  // Mirror key computed styles and position overlay to textarea's content box.
  useEffect(() => {
    const ta = resolvedTextareaRef.current;
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
  }, [resolvedTextareaRef]);

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div
        ref={overlayRef}
        aria-hidden="true"
        className={cn(
          "absolute",
          "overflow-hidden",
          "pointer-events-none",
          "whitespace-pre-wrap",
          "break-words",
          "text-transparent",
          "will-change-transform -mx-[0.5px]",
          "rounded-lg"
        )}
        dangerouslySetInnerHTML={{
          __html: highlightedHtml + (value?.endsWith("\n") ? "\n" : ""),
        }}
      />

      <textarea
        ref={resolvedTextareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={onClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        placeholder={placeholder}
        className={cn(
          "w-full resize-y",
          "rounded-lg border border-zinc-300",
          "text-sm leading-6",
          "p-3",
          "overflow-auto",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          !editable && "!border-0 !resize-none",
          textareaClassName
        )}
        spellCheck={false}
        autoComplete="off"
        disabled={!editable}
        rows={rows}
        autoCorrect="off"
        autoCapitalize="off"
        style={{ whiteSpace: "pre-wrap", overscrollBehaviorY: "none" }}
      />
    </div>
  );
}
