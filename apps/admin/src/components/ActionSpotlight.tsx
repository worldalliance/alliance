import type {
  ActionCategory,
  AdminActionListItemDto,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { Dialog } from "@base-ui/react/dialog";
import { Search, Tag, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  actionCategoryLabel,
  categoryCounts,
  matchingCategories,
  searchActions,
  type CategoryCount,
} from "../lib/actionSpotlightSearch";
import {
  ACTION_STATUS_BUCKET_LABELS,
  actionStatusBucket,
} from "../lib/actionStatusBucket";

enum SpotlightItemKind {
  Category = "category",
  Action = "action",
}

type SpotlightItem =
  | { kind: SpotlightItemKind.Category; category: CategoryCount }
  | { kind: SpotlightItemKind.Action; action: AdminActionListItemDto };

const KEY_OWNERS =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"]';

const isPrintableKey = (event: KeyboardEvent) =>
  !event.metaKey &&
  !event.ctrlKey &&
  !event.altKey &&
  !event.isComposing &&
  event.key.length === 1 &&
  event.key.trim() !== "";

const ActionSpotlight = ({
  actions,
  onPick,
}: {
  actions: AdminActionListItemDto[];
  onPick: (action: AdminActionListItemDto) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ActionCategory | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const listId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPrintableKey(event)) {
        return;
      }
      // Keys typed before the dialog moves focus to its input would be lost.
      if (openRef.current) {
        if (event.target !== inputRef.current) {
          event.preventDefault();
          setQuery((previous) => previous + event.key);
          setActiveIndex(0);
          inputRef.current?.focus();
        }
        return;
      }
      if (event.target instanceof Element && event.target.closest(KEY_OWNERS)) {
        return;
      }
      event.preventDefault();
      setQuery(event.key === "/" ? "" : event.key);
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const categories = useMemo(() => categoryCounts(actions), [actions]);
  const items: SpotlightItem[] = [
    ...(category ? [] : matchingCategories(categories, query)).map((match) => ({
      kind: SpotlightItemKind.Category as const,
      category: match,
    })),
    ...searchActions({ actions, query, category }).map((action) => ({
      kind: SpotlightItemKind.Action as const,
      action,
    })),
  ];
  const active = Math.min(activeIndex, items.length - 1);
  const optionId = (index: number) => `${listId}-${index}`;

  const close = () => {
    setOpen(false);
    setQuery("");
    setCategory(null);
    setActiveIndex(0);
  };

  const pick = (item: SpotlightItem) => {
    switch (item.kind) {
      case SpotlightItemKind.Category:
        setCategory(item.category.category);
        setQuery("");
        setActiveIndex(0);
        inputRef.current?.focus();
        return;
      case SpotlightItemKind.Action:
        close();
        onPick(item.action);
        return;
      default:
        throw new Error(`unknown spotlight item: ${item satisfies never}`);
    }
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex(Math.min(active + 1, items.length - 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex(Math.max(active - 1, 0));
        return;
      case "Enter":
        event.preventDefault();
        if (items[active]) {
          pick(items[active]);
        }
        return;
      case "Backspace":
        if (query === "" && category) {
          event.preventDefault();
          setCategory(null);
          setActiveIndex(0);
        }
        return;
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(zIndex.modal, "fixed inset-0 bg-black/40")}
        />
        <Dialog.Popup
          initialFocus={inputRef}
          aria-label="Search actions"
          className={cn(
            zIndex.modal,
            "fixed left-1/2 top-[30vh] w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-xl bg-white shadow-2xl outline-none",
          )}
        >
          <div className="flex items-center gap-x-2 px-4 py-3">
            <Search
              size={20}
              className="shrink-0 text-zinc-400"
              aria-hidden="true"
            />
            {category && (
              <span className="flex shrink-0 items-center gap-x-1 rounded bg-zinc-100 py-0.5 pl-2 pr-1 text-sm text-zinc-700">
                {actionCategoryLabel(category)}
                <button
                  type="button"
                  aria-label={`Remove ${actionCategoryLabel(category)} filter`}
                  onClick={() => {
                    setCategory(null);
                    setActiveIndex(0);
                    inputRef.current?.focus();
                  }}
                  className="rounded p-0.5 hover:bg-zinc-200"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            )}
            <input
              ref={inputRef}
              role="combobox"
              aria-label="Search actions"
              aria-autocomplete="list"
              aria-expanded={items.length > 0}
              aria-controls={listId}
              aria-activedescendant={
                items.length > 0 ? optionId(active) : undefined
              }
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              className="min-w-0 flex-1 bg-transparent text-lg outline-none"
            />
          </div>
          {items.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              className="border-t border-zinc-200 py-1"
            >
              {items.map((item, index) => (
                <li
                  key={
                    item.kind === SpotlightItemKind.Category
                      ? `category-${item.category.category}`
                      : `action-${item.action.id}`
                  }
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => pick(item)}
                  className={cn(
                    "flex cursor-pointer items-center gap-x-2 px-4 py-2 text-sm",
                    index === active && "bg-zinc-100",
                  )}
                >
                  <SpotlightItemRow item={item} />
                </li>
              ))}
            </ul>
          ) : (
            (query !== "" || category) && (
              <p className="border-t border-zinc-200 px-4 py-3 text-sm text-zinc-500">
                No matching actions
              </p>
            )
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const SpotlightItemRow = ({ item }: { item: SpotlightItem }) => {
  switch (item.kind) {
    case SpotlightItemKind.Category:
      return (
        <>
          <Tag
            size={14}
            className="shrink-0 text-zinc-400"
            aria-hidden="true"
          />
          <span className="font-medium text-black">
            {actionCategoryLabel(item.category.category)}
          </span>
          <span className="text-zinc-400">{item.category.count}</span>
        </>
      );
    case SpotlightItemKind.Action:
      return (
        <>
          <span className="truncate font-medium text-black">
            {item.action.name}
          </span>
          <span className="shrink-0 rounded border border-black/10 px-1 text-xs leading-4 text-zinc-600">
            {ACTION_STATUS_BUCKET_LABELS[actionStatusBucket(item.action)]}
          </span>
          {item.action.project && (
            <span className="truncate text-zinc-400">
              {item.action.project.name}
            </span>
          )}
        </>
      );
    default:
      throw new Error(`unknown spotlight item: ${item satisfies never}`);
  }
};

export default ActionSpotlight;
