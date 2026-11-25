import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { useFormsAdmin } from "@alliance/shared/lib/useFormsAdmin";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { type LucideIcon, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  adminSearchResults,
  SEARCH_KIND_LABELS,
  type SearchResult,
} from "../lib/adminSearch";
import { useActionSuitesAdmin } from "../lib/useActionSuitesAdmin";
import { useCommunitiesAdmin } from "../lib/useCommunitiesAdmin";
import { useUsersAdmin } from "../lib/useUsersAdmin";
import type { CountId } from "../places";
import { cn } from "../ui/cn";
import { Kbd } from "../ui/Kbd";
import Modal from "../ui/Modal";
import { CountBadge } from "./CountBadge";
import { BROWSE_GROUPS, SEARCH_PAGES } from "./paletteEntries";
import { PLACE_ICONS } from "./placeIcons";
import type { QueueCount } from "./useQueueCounts";

type Entry = {
  key: string;
  label: string;
  to: string;
  icon?: LucideIcon;
  /** Shown before the label: what kind of thing a search result is. */
  kind?: string;
  detail?: string | null;
  count?: QueueCount;
};

type Group = { value: string; items: Entry[] };

const resultEntry = (result: SearchResult): Entry => ({
  key: `${result.kind}:${result.to}:${result.label}`,
  label: result.label,
  to: result.to,
  kind: SEARCH_KIND_LABELS[result.kind],
  detail: result.detail,
});

const ITEM =
  "flex h-control cursor-default items-center gap-2.5 rounded-md px-2.5 outline-none data-highlighted:bg-accent-soft";

function PaletteContent({
  counts,
  onClose,
}: {
  counts: Record<CountId, QueueCount>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const members = useUsersAdmin();
  const actions = useActionsAdmin();
  const { suites } = useActionSuitesAdmin();
  const forms = useFormsAdmin();
  const groups = useCommunitiesAdmin();
  const searching = query.trim() !== "";

  const results = useMemo(
    () =>
      adminSearchResults({
        query,
        pages: SEARCH_PAGES,
        actions: actions.data ?? [],
        suites: suites.data ?? [],
        members: members.data ?? [],
        forms: forms.forms,
        groups: groups.data ?? [],
      }),
    [query, actions.data, suites.data, members.data, forms.forms, groups.data],
  );
  const browse = useMemo<Group[]>(
    () =>
      BROWSE_GROUPS.map((group) => ({
        value: group.label,
        items: group.places.map((place) => ({
          key: place.id,
          label: place.label,
          to: place.path,
          icon: PLACE_ICONS[place.id],
          count: place.count && counts[place.count],
        })),
      })),
    [counts],
  );
  const items = useMemo<Group[]>(
    () =>
      searching
        ? [{ value: "Results", items: results.map(resultEntry) }]
        : browse,
    [searching, results, browse],
  );

  const lists = [
    { label: "tasks", isLoading: actions.isLoading, isError: actions.isError },
    { label: "suites", isLoading: suites.isLoading, isError: suites.isError },
    {
      label: "members",
      isLoading: members.isLoading,
      isError: members.isError,
    },
    { label: "forms", isLoading: forms.isLoading, isError: forms.isError },
    { label: "groups", isLoading: groups.isLoading, isError: groups.isError },
  ];
  const loading = lists.filter((list) => list.isLoading);
  const failed = lists.filter((list) => list.isError);

  return (
    <Autocomplete.Root
      items={items}
      open
      inline
      mode="none"
      autoHighlight="always"
      keepHighlight
      value={query}
      onValueChange={setQuery}
      itemToStringValue={(entry: Entry) => entry.label}
    >
      <div className="flex h-12 items-center gap-2.5 border-b border-line px-4">
        <Search className="size-4.5 shrink-0 text-fg-muted" aria-hidden />
        <Autocomplete.Input
          autoFocus
          aria-label="Search"
          placeholder="Search pages, tasks, suites, members, forms, groups"
          className="h-full min-w-0 flex-1 bg-transparent text-heading outline-none placeholder:text-fg-muted"
        />
        <Kbd>Esc</Kbd>
      </div>
      {/* The height is fixed so typing never resizes the dialog. */}
      <div className="h-128 overflow-y-auto p-2">
        <Autocomplete.List
          aria-label={searching ? "Search results" : "All pages"}
          className={cn("outline-none", !searching && "columns-3 gap-2")}
        >
          {(group: Group) => (
            <Autocomplete.Group
              key={group.value}
              items={group.items}
              className="break-inside-avoid pb-2"
            >
              <Autocomplete.GroupLabel
                className={cn(
                  "px-2.5 pt-2 pb-1 text-caption font-medium text-fg-muted",
                  searching && "sr-only",
                )}
              >
                {group.value}
              </Autocomplete.GroupLabel>
              <Autocomplete.Collection>
                {(entry: Entry) => (
                  <Autocomplete.Item
                    key={entry.key}
                    value={entry}
                    render={<Link to={entry.to} />}
                    onClick={onClose}
                    className={ITEM}
                  >
                    {entry.icon && (
                      <entry.icon
                        className="size-4.5 shrink-0 text-fg-muted"
                        aria-hidden
                      />
                    )}
                    {entry.kind && (
                      <span className="w-14 shrink-0 text-caption text-fg-muted">
                        {entry.kind}
                      </span>
                    )}
                    <span className="min-w-0 truncate">{entry.label}</span>
                    {entry.detail && (
                      <span className="ml-auto min-w-0 truncate pl-4 text-caption text-fg-muted">
                        {entry.detail}
                      </span>
                    )}
                    <CountBadge count={entry.count} className="ml-auto" />
                  </Autocomplete.Item>
                )}
              </Autocomplete.Collection>
            </Autocomplete.Group>
          )}
        </Autocomplete.List>
      </div>
      <div className="flex h-9 items-center gap-4 border-t border-line bg-surface-2 px-4 text-caption text-fg-muted">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> open
        </span>
        <span role="status" className="ml-auto min-w-0 truncate">
          {searching && results.length === 0 && loading.length === 0
            ? "No matches. "
            : ""}
          {loading.length > 0 &&
            `Loading ${loading.map((list) => list.label).join(", ")}… `}
          {failed.length > 0 && (
            <span className="text-danger">
              {`Couldn't load ${failed.map((list) => list.label).join(", ")}, so they aren't searched.`}
            </span>
          )}
        </span>
      </div>
    </Autocomplete.Root>
  );
}

/**
 * Every page and search in one dialog: with nothing typed it lists every place
 * by area, and typing finds pages (by today's name or the one they had before)
 * and records. ⌘K opens it from anywhere.
 */
export default function Palette({
  open,
  onOpenChange,
  counts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: Record<CountId, QueueCount>;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <Modal
      onClose={() => onOpenChange(false)}
      ariaLabel="All pages and search"
      panelClassName="max-w-4xl overflow-hidden"
    >
      <PaletteContent counts={counts} onClose={() => onOpenChange(false)} />
    </Modal>
  );
}
