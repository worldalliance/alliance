import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { useFormsAdmin } from "@alliance/shared/lib/useFormsAdmin";
import { cn } from "@alliance/shared/styles/util";
import Modal from "@alliance/sharedweb/ui/Modal";
import { Search } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { adminSearchResults, SEARCH_KIND_LABELS } from "../lib/adminSearch";
import { useActionSuitesAdmin } from "../lib/useActionSuitesAdmin";
import { useCommunitiesAdmin } from "../lib/useCommunitiesAdmin";
import { useUsersAdmin } from "../lib/useUsersAdmin";
import { searchPages } from "./adminNavEntries";

const SearchPalette = ({ onClose }: { onClose: () => void }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const members = useUsersAdmin();
  const actions = useActionsAdmin();
  const { suites } = useActionSuitesAdmin();
  const forms = useFormsAdmin();
  const groups = useCommunitiesAdmin();

  const results = useMemo(
    () =>
      adminSearchResults({
        query,
        pages: searchPages(),
        actions: actions.data ?? [],
        suites: suites.data ?? [],
        members: members.data ?? [],
        forms: forms.forms,
        groups: groups.data ?? [],
      }),
    [query, actions.data, suites.data, members.data, forms.forms, groups.data],
  );
  const lists = [
    {
      label: "actions",
      isLoading: actions.isLoading,
      isError: actions.isError,
    },
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

  useEffect(() => {
    listRef.current?.children[activeIndex]?.scrollIntoView?.({
      block: "nearest",
    });
  }, [activeIndex]);

  const open = (to: string) => {
    onClose();
    void navigate(to);
  };

  // Results can change under a kept index as lists load, so clamp at use.
  const highlighted = Math.min(activeIndex, results.length - 1);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && results.length) {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((highlighted + step + results.length) % results.length);
    } else if (e.key === "Enter" && results[highlighted]) {
      e.preventDefault();
      open(results[highlighted].to);
    }
  };

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Search the admin panel"
      panelClassName="w-full max-w-xl p-0 overflow-hidden"
    >
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4">
        <Search className="size-4 text-zinc-400" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Pages, actions, suites, members, forms, groups"
          aria-label="Search"
          className="w-full py-3 text-sm outline-none"
        />
      </div>
      <ul ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
        {results.map((result, index) => (
          <li key={`${result.kind}:${result.to}`}>
            <Link
              to={result.to}
              onClick={onClose}
              onMouseMove={() => setActiveIndex(index)}
              className={cn(
                "flex items-baseline gap-3 px-4 py-2 text-sm",
                index === highlighted && "bg-zinc-100",
              )}
            >
              <span className="w-14 shrink-0 text-xs text-zinc-500">
                {SEARCH_KIND_LABELS[result.kind]}
              </span>
              <span className="min-w-0 shrink-0 max-w-[65%] truncate">
                {result.label}
              </span>
              {result.detail && (
                <span className="ml-auto min-w-0 truncate text-xs text-zinc-500">
                  {result.detail}
                </span>
              )}
            </Link>
          </li>
        ))}
        {query.trim() && results.length === 0 && loading.length === 0 && (
          <li className="px-4 py-2 text-sm text-zinc-500">No matches</li>
        )}
      </ul>
      {(loading.length > 0 || failed.length > 0) && (
        <p className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500">
          {loading.length > 0 &&
            `Loading ${loading.map((list) => list.label).join(", ")}… `}
          {failed.length > 0 && (
            <span className="text-red-600">
              {`Couldn't load ${failed.map((list) => list.label).join(", ")}, so they aren't searched.`}
            </span>
          )}
        </p>
      )}
    </Modal>
  );
};

const AdminSearch = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-500 hover:border-zinc-400"
      >
        <Search size={14} aria-hidden />
        Search
        <kbd className="ml-auto font-sans text-xs text-zinc-400">⌘K</kbd>
      </button>
      {open && <SearchPalette onClose={() => setOpen(false)} />}
    </>
  );
};

export default AdminSearch;
