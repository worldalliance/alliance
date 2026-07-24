import type {
  FormValue,
  RankingField,
} from "@alliance/common/forms/form-schema";
import {
  getRankingOptionLabel,
  getRankingSlotCount,
  sanitizeRankingValue,
} from "@alliance/common/forms/ranking";
import { cn } from "@alliance/shared/styles/util";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  defaultAnimateLayoutChanges,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";

const POOL_DROP_ID = "ranking-pool";
const ENTER_ANIMATION_MS = 220;

// Sortable ids are namespaced so an admin-authored option value can never
// collide with POOL_DROP_ID (which would remove the row instead of reordering).
const OPTION_DRAG_ID_PREFIX = "option:";
const optionDragId = (option: string) => `${OPTION_DRAG_ID_PREFIX}${option}`;
const dragIdToOption = (id: string | number) =>
  String(id).slice(OPTION_DRAG_ID_PREFIX.length);

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Animate sibling shifts for non-drag changes (click-to-place, X removal).
 * During and right after a drag, defer to the default so the parting that
 * already happened while sorting isn't replayed on drop.
 */
const animateRankingLayoutChanges: AnimateLayoutChanges = (args) =>
  args.isSorting || args.wasDragging ? defaultAnimateLayoutChanges(args) : true;

type RankingFieldInputProps = {
  field: RankingField;
  value: FormValue | undefined;
  onChange?: (value: FormValue) => void;
  disabled?: boolean;
  hasError?: boolean;
  isOutputView?: boolean;
};

function SlotNumberBadge({
  slotIndex,
  filled,
}: {
  slotIndex: number;
  filled: boolean;
}) {
  return (
    <span
      className={cn(
        // Rows are top-aligned; mt-1.5 centers the badge on the card's first
        // line of text (py-2 + one text-sm line).
        "mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
        filled ? "bg-green text-white" : "bg-zinc-200 text-zinc-500",
      )}
    >
      {slotIndex + 1}
    </span>
  );
}

function RowContent({ label, remove }: { label: string; remove?: ReactNode }) {
  return (
    <>
      <span className="min-w-0 flex-1 break-words text-zinc-700">
        <FormMarkdownWrapper markdownContent={label} />
      </span>
      {remove}
    </>
  );
}

/** The draggable card: the row minus the rank badge, which belongs to the slot. */
const cardClasses =
  "flex min-w-0 flex-1 select-none items-center gap-3 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";

/** Droppable wrapper for the option pool: dragging a ranked row here removes it. */
function OptionPool({
  interactive,
  children,
}: {
  interactive: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: POOL_DROP_ID,
    disabled: !interactive,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-wrap gap-2 rounded-md",
        isOver && "outline-dashed outline-1 outline-offset-4 outline-zinc-400",
      )}
    >
      {children}
    </div>
  );
}

function RankedRow({
  option,
  label,
  interactive,
  animateIn,
  onRemove,
}: {
  option: string;
  label: string;
  interactive: boolean;
  animateIn: boolean;
  onRemove: (option: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    index,
    newIndex,
    over,
  } = useSortable({
    id: optionDragId(option),
    disabled: !interactive,
    animateLayoutChanges: animateRankingLayoutChanges,
  });
  const hasAnimatedIn = useRef(false);

  // While sorting, show the slot this row is projected to land in, so the
  // badge column reads 1..n in visual order as rows are displaced. Hovering
  // the pool undoes the projection (that drop removes rather than reorders).
  const slotIndex = over && over.id !== POOL_DROP_ID ? newIndex : index;

  const cardRef = (element: HTMLDivElement | null) => {
    // The card is the measured sortable node (so the drag overlay clones its
    // exact size), while the displacement transform is applied to the whole
    // row below, carrying the badge along with the card.
    setNodeRef(element);
    // Newly placed from the pool: ease the row in. Skipped on the form's
    // initial render (saved answers shouldn't animate).
    if (element && animateIn && !hasAnimatedIn.current) {
      hasAnimatedIn.current = true;
      if (!prefersReducedMotion()) {
        element.animate(
          [
            { opacity: 0, transform: "scale(0.95)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: ENTER_ANIMATION_MS, easing: "ease-out" },
        );
      }
    }
  };

  return (
    <li
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-start gap-3"
    >
      <SlotNumberBadge slotIndex={slotIndex} filled />
      <div
        ref={cardRef}
        {...attributes}
        {...(interactive ? listeners : {})}
        className={cn(
          cardClasses,
          "touch-manipulation",
          interactive && "cursor-grab",
          // The DragOverlay copy follows the pointer; this in-list card stays
          // behind as a dim placeholder marking where the item would land.
          isDragging && "opacity-40",
        )}
      >
        <RowContent
          label={label}
          remove={
            interactive ? (
              <button
                type="button"
                onClick={() => onRemove(option)}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                aria-label={`Remove item ranked ${slotIndex + 1}`}
                className="shrink-0 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            ) : undefined
          }
        />
      </div>
    </li>
  );
}

export function RankingFieldInput({
  field,
  value,
  onChange,
  disabled,
  hasError,
  isOutputView,
}: RankingFieldInputProps) {
  const ranked = sanitizeRankingValue(field, value);
  const slotCount = getRankingSlotCount(field);
  const interactive = !disabled && !!onChange && !isOutputView;
  const [activeOption, setActiveOption] = useState<string | null>(null);

  const hasRenderedOnce = useRef(false);
  useEffect(() => {
    hasRenderedOnce.current = true;
  }, []);

  // Saved answers can go stale (an admin edits the option list after a draft
  // was saved). The list renders the sanitized ranking, so commit it whenever
  // it differs from the stored array — otherwise validation and submission
  // would see a stale value the user can't see.
  useEffect(() => {
    if (!interactive || !Array.isArray(value)) return;
    if (
      value.length === ranked.length &&
      value.every((entry, index) => entry === ranked[index])
    ) {
      return;
    }
    onChange?.(ranked);
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const commit = (next: string[]) => onChange?.(next);

  const toggleOption = (option: string) => {
    if (ranked.includes(option)) {
      commit(ranked.filter((entry) => entry !== option));
    } else if (ranked.length < slotCount) {
      commit([...ranked, option]);
    }
  };

  const removeOption = (option: string) =>
    commit(ranked.filter((entry) => entry !== option));

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveOption(dragIdToOption(active.id));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveOption(null);
    if (!over) return;
    const activeValue = dragIdToOption(active.id);
    if (over.id === POOL_DROP_ID) {
      commit(ranked.filter((entry) => entry !== activeValue));
      return;
    }
    const from = ranked.indexOf(activeValue);
    const to = ranked.indexOf(dragIdToOption(over.id));
    if (from === -1 || to === -1 || from === to) return;
    commit(arrayMove(ranked, from, to));
  };

  const handleDragCancel = () => {
    setActiveOption(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className={cn(
          "space-y-3",
          hasError && "border-l-2 border-red-500 pl-3",
        )}
      >
        {!isOutputView && (
          <OptionPool interactive={interactive}>
            {field.options.map((option) => {
              const isRanked = ranked.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={
                    interactive ? () => toggleOption(option.value) : undefined
                  }
                  disabled={
                    !interactive || (!isRanked && ranked.length >= slotCount)
                  }
                  className={cn(
                    "max-w-full break-words rounded-md border px-3 py-2 text-left text-sm transition-colors duration-200",
                    isRanked
                      ? "border-zinc-200 bg-zinc-100 text-zinc-400"
                      : "border-zinc-300 bg-white text-zinc-700",
                    interactive &&
                      !isRanked &&
                      "cursor-pointer hover:border-green",
                    interactive &&
                      !isRanked &&
                      ranked.length >= slotCount &&
                      "cursor-not-allowed opacity-60",
                    !interactive && "cursor-default",
                  )}
                >
                  <FormMarkdownWrapper markdownContent={option.label} />
                </button>
              );
            })}
          </OptionPool>
        )}
        <SortableContext
          items={ranked.map(optionDragId)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="space-y-2">
            {ranked.map((option) => (
              <RankedRow
                key={option}
                option={option}
                label={getRankingOptionLabel(field, option)}
                interactive={interactive}
                animateIn={hasRenderedOnce.current}
                onRemove={removeOption}
              />
            ))}
            {Array.from(
              { length: slotCount - ranked.length },
              (_, emptyIndex) => {
                const slotIndex = ranked.length + emptyIndex;
                return (
                  <li
                    key={`empty-${slotIndex}`}
                    className="flex items-start gap-3"
                  >
                    <SlotNumberBadge slotIndex={slotIndex} filled={false} />
                    <div className="flex min-w-0 flex-1 select-none items-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm">
                      <span className="text-zinc-400">
                        {interactive ? "Select an item" : "—"}
                      </span>
                    </div>
                  </li>
                );
              },
            )}
          </ol>
        </SortableContext>
        <DragOverlay>
          {activeOption !== null ? (
            <div className={cn(cardClasses, "cursor-grabbing shadow-lg")}>
              <RowContent
                label={getRankingOptionLabel(field, activeOption)}
                // Visual-only stand-in for the X button so the overlay's text
                // wraps exactly like the card it was lifted from.
                remove={
                  <span aria-hidden className="shrink-0 text-zinc-400">
                    <X className="h-4 w-4" />
                  </span>
                }
              />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
