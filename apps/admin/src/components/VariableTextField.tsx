import type { FormVariable } from "@alliance/common/forms/variables";
import {
  VARIABLE_REFERENCE_OPEN,
  variableReferencePattern,
} from "@alliance/common/forms/variables";
import { SquareFunction } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { TextareaAutosizeProps } from "react-textarea-autosize";
import { focusInPlace } from "../pages/forms/builder/kit/revealInPane";
import { cn } from "../ui/cn";
import { popupClass } from "../ui/styles";
import { zIndex } from "../ui/zIndex";
import FormTextarea from "./FormTextarea";
import { useFormVariables } from "./FormVariablesContext";

const PARTIAL_NAME = /^[A-Za-z0-9_-]*$/;

type Segment = { text: string; known?: boolean };

function toSegments(text: string, declared: ReadonlySet<string>): Segment[] {
  const segments: Segment[] = [];
  let index = 0;
  for (const match of text.matchAll(variableReferencePattern())) {
    if (match.index > index) {
      segments.push({ text: text.slice(index, match.index) });
    }
    segments.push({ text: match[0], known: declared.has(match[1]) });
    index = match.index + match[0].length;
  }
  if (index < text.length) segments.push({ text: text.slice(index) });
  return segments;
}

function referenceBeingTyped(
  value: string,
  caret: number,
): { start: number; query: string } | null {
  const start = value.lastIndexOf(VARIABLE_REFERENCE_OPEN, caret);
  if (start === -1) return null;
  const query = value.slice(start + VARIABLE_REFERENCE_OPEN.length, caret);
  return PARTIAL_NAME.test(query) ? { start, query } : null;
}

type Menu = {
  replaceFrom: number;
  query: string;
};

export type VariableTextFieldProps = {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  className?: string;
  /**
   * For the wrapper element, which is what sits in the caller's layout — sizing
   * classes like `flex-1` do nothing on the input nested inside it.
   */
  containerClassName?: string;
  placeholder?: string;
  rows?: number;
  minRows?: number;
  style?: TextareaAutosizeProps["style"];
  spellCheck?: boolean;
  /** Lets a `Field` label bind to the input. */
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function VariableTextField({
  value,
  onChange,
  multiline = false,
  className,
  containerClassName,
  placeholder,
  rows,
  minRows,
  style,
  spellCheck,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: VariableTextFieldProps) {
  const variables = useFormVariables();
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef(0);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const element = (): HTMLInputElement | HTMLTextAreaElement | null =>
    multiline ? textareaRef.current : inputRef.current;

  const declared = useMemo(
    () => new Set(variables.map((variable) => variable.name)),
    [variables],
  );

  const options = useMemo((): FormVariable[] => {
    if (!menu) return [];
    const query = menu.query.toLowerCase();
    return variables.filter((variable) =>
      variable.name.toLowerCase().includes(query),
    );
  }, [menu, variables]);

  useEffect(() => setActiveIndex(0), [menu?.query, menu?.replaceFrom]);

  const segments = useMemo(
    () =>
      variables.length > 0 && value.includes(VARIABLE_REFERENCE_OPEN)
        ? toSegments(value, declared)
        : null,
    [value, declared, variables.length],
  );

  const unknownReferences = useMemo(
    () =>
      segments
        ?.filter((segment) => segment.known === false)
        .map((segment) => segment.text) ?? [],
    [segments],
  );

  const syncCaret = () => {
    caretRef.current = element()?.selectionStart ?? value.length;
  };

  const updateMenu = (caret: number, nextValue: string) => {
    if (variables.length === 0) return;
    const typing = referenceBeingTyped(nextValue, caret);
    setMenu(typing ? { replaceFrom: typing.start, query: typing.query } : null);
  };

  const handleChange = (nextValue: string) => {
    onChange(nextValue);
    const caret = element()?.selectionStart ?? nextValue.length;
    caretRef.current = caret;
    updateMenu(caret, nextValue);
  };

  const insert = (name: string) => {
    const from = menu?.replaceFrom ?? caretRef.current;
    const reference = `${VARIABLE_REFERENCE_OPEN}${name}}`;
    onChange(value.slice(0, from) + reference + value.slice(caretRef.current));
    setMenu(null);

    const caret = from + reference.length;
    caretRef.current = caret;
    requestAnimationFrame(() => {
      const target = element();
      focusInPlace(target);
      target?.setSelectionRange(caret, caret);
    });
  };

  // The button suppresses its own mousedown to keep the caret where the user
  // left it, so a field that was never focused still reports selectionStart 0 —
  // taking that at face value would insert the reference before the existing
  // text. Focus it at the end first, so there is a real caret to insert at.
  const openPicker = () => {
    const target = element();
    if (target && document.activeElement !== target) {
      focusInPlace(target);
      target.setSelectionRange(value.length, value.length);
    }
    syncCaret();
    setMenu({ replaceFrom: caretRef.current, query: "" });
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (event.key === "Escape" && menu) {
      event.preventDefault();
      setMenu(null);
      return;
    }
    if (!menu || options.length === 0) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % options.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex(
          (index) => (index - 1 + options.length) % options.length,
        );
        break;
      case "Enter":
      case "Tab":
        event.preventDefault();
        insert(options[activeIndex].name);
        break;
      default:
        break;
    }
  };

  const showPicker = variables.length > 0;
  const sharedClassName = cn(className, showPicker && "pr-8");
  const inputProps = {
    value,
    placeholder,
    spellCheck,
    // Only while something is highlighted, so a field with no reference in it
    // keeps whatever background it had. Inline rather than `bg-transparent`
    // because a caller's own background rule can outrank the utility class,
    // and an opaque input hides the highlight painted behind it.
    style: segments ? { backgroundColor: "transparent", ...style } : style,
    id,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    className: cn(sharedClassName, "relative"),
    onKeyDown: handleKeyDown,
    onSelect: syncCaret,
    onClick: syncCaret,
    onBlur: () => setMenu(null),
    onScroll: () => {
      if (overlayRef.current && element()) {
        overlayRef.current.scrollLeft = element()?.scrollLeft ?? 0;
      }
    },
  };

  return (
    <div className={cn("relative", containerClassName)}>
      <div className="relative">
        {segments && (
          <div
            ref={overlayRef}
            aria-hidden
            className={cn(
              sharedClassName,
              "pointer-events-none absolute inset-0 overflow-hidden border-transparent break-words whitespace-pre-wrap text-transparent",
            )}
          >
            {segments.map((segment, index) => (
              <span
                key={index}
                className={cn(
                  "rounded-sm",
                  segment.known === true && "bg-success-soft",
                  segment.known === false && "bg-danger-soft",
                )}
              >
                {segment.text}
              </span>
            ))}
          </div>
        )}

        {multiline ? (
          <FormTextarea
            {...inputProps}
            textareaRef={textareaRef}
            rows={rows}
            minRows={minRows}
            onChange={(event) => handleChange(event.target.value)}
          />
        ) : (
          <input
            {...inputProps}
            ref={inputRef}
            type="text"
            onChange={(event) => handleChange(event.target.value)}
          />
        )}

        {showPicker && (
          <button
            type="button"
            title="Insert a formula"
            aria-label="Insert a formula"
            onMouseDown={(event) => event.preventDefault()}
            onClick={openPicker}
            className="absolute top-1.5 right-1.5 rounded-sm p-0.5 text-fg-muted focus-ring hover:bg-surface-2 hover:text-fg"
          >
            <SquareFunction aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      {menu && options.length > 0 && (
        <ul
          role="listbox"
          aria-label="Formulas"
          className={cn(
            popupClass,
            zIndex.popover,
            "absolute top-full left-0 mt-1 max-h-48 w-64 max-w-full overflow-y-auto py-1",
          )}
        >
          {options.map((variable, index) => (
            <li key={variable.name}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => insert(variable.name)}
                className={cn(
                  "flex w-full flex-col items-start px-2.5 py-1 text-left",
                  index === activeIndex && "bg-accent-soft",
                )}
              >
                <span className="font-mono text-caption">
                  {VARIABLE_REFERENCE_OPEN}
                  {variable.name}
                  {"}"}
                </span>
                <span className="w-full truncate font-mono text-caption text-fg-muted">
                  {variable.formula}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {unknownReferences.length > 0 && (
        <p className="mt-1 text-caption text-danger">
          No such formula: {unknownReferences.join(", ")}
        </p>
      )}
    </div>
  );
}
