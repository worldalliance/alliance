import { useCallback, useEffect, useRef, useState } from "react";

const FOCUSABLE_SELECTOR =
  'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex="0"]:not(:disabled)';

export function useFormScroll({
  scrollContainerRef,
  currentPageIndex,
}: {
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  currentPageIndex: number;
}) {
  const formTopRef = useRef<HTMLDivElement>(null);
  const fieldElements = useRef(new Map<string, HTMLDivElement>());
  // A fresh object per failed attempt, so submitting twice on the same bad
  // field re-runs the focus effect instead of being skipped as unchanged.
  const [invalidFieldFocus, setInvalidFieldFocus] = useState<{
    fieldId?: string;
  } | null>(null);

  // `scrollIntoView` moves every scrollable ancestor, the document included,
  // so a caller-supplied container is scrolled on its own instead.
  const scrollElementIntoView = useCallback(
    (element: HTMLElement) => {
      const container = scrollContainerRef?.current;
      if (!container) {
        element.scrollIntoView({ behavior: "instant", block: "start" });
        return;
      }
      const rawScrollMarginTop = parseFloat(
        getComputedStyle(element).scrollMarginTop,
      );
      const scrollMarginTop = Number.isFinite(rawScrollMarginTop)
        ? rawScrollMarginTop
        : 0;
      const targetTop =
        element.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        scrollMarginTop;
      container.scrollTo({ top: Math.max(0, targetTop), behavior: "instant" });
    },
    [scrollContainerRef],
  );

  const prevPageIndexRef = useRef(currentPageIndex);
  useEffect(() => {
    if (prevPageIndexRef.current === currentPageIndex) {
      return;
    }
    prevPageIndexRef.current = currentPageIndex;
    const top = formTopRef.current;
    if (top) scrollElementIntoView(top);
  }, [currentPageIndex]);

  useEffect(() => {
    if (!invalidFieldFocus?.fieldId) return;
    const field = fieldElements.current.get(invalidFieldFocus.fieldId);
    if (!field) return;
    const invalid =
      field.querySelector<HTMLElement>('[aria-invalid="true"]') ?? field;
    const control = invalid.matches(FOCUSABLE_SELECTOR)
      ? invalid
      : invalid.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    scrollElementIntoView(field);
    (control ?? field).focus();
  }, [invalidFieldFocus]);

  const fieldRef = (fieldId: string) => (element: HTMLDivElement | null) => {
    if (element) fieldElements.current.set(fieldId, element);
    else fieldElements.current.delete(fieldId);
  };

  const focusInvalidField = useCallback(
    (fieldId: string | undefined) => setInvalidFieldFocus({ fieldId }),
    [],
  );

  return { formTopRef, fieldRef, focusInvalidField };
}
