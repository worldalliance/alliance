import type { NeedsReplyMemberDto } from "@alliance/shared/client/types.gen";
import { useClockMinute } from "@alliance/shared/lib/useClockMinute";
import { cn } from "@alliance/shared/styles/util";
import { formatDistanceToNow } from "date-fns";
import {
  type FocusEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { href, Link } from "react-router";
import { SectionRefreshError } from "../components/user-detail/SectionQueryState";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useNeedsReplyAdmin } from "../lib/useMemberTextsAdmin";

type Row = { member: NeedsReplyMemberDto; left: boolean };

const subscribeToVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

const nextRows = (params: {
  shown: Row[];
  members: NeedsReplyMemberDto[];
  held: boolean;
}): Row[] => {
  const { shown, members, held } = params;
  if (!held) return members.map((member) => ({ member, left: false }));
  const latest = new Map(members.map((m) => [m.userId, m]));
  const kept = shown.map((row): Row => {
    const member = latest.get(row.member.userId);
    return member ? { member, left: false } : { ...row, left: true };
  });
  const keptIds = new Set(shown.map((row) => row.member.userId));
  return [
    ...kept,
    ...members
      .filter((m) => !keptIds.has(m.userId))
      .map((member) => ({ member, left: false })),
  ];
};

/** So a poll never moves the row about to be clicked. */
function useHeldRows(members: NeedsReplyMemberDto[] | undefined) {
  const [pointerIn, setPointerIn] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  const hidden = useSyncExternalStore(
    subscribeToVisibility,
    () => document.hidden,
  );
  const held = (pointerIn || focusIn) && !hidden;
  const [shown, setShown] = useState<{
    members?: NeedsReplyMemberDto[];
    held: boolean;
    rows: Row[];
  }>({ held: false, rows: [] });
  let rows = shown.rows;
  if (members && (shown.members !== members || shown.held !== held)) {
    rows = nextRows({ shown: shown.rows, members, held });
    setShown({ members, held, rows });
  }
  const list = useRef<HTMLDivElement>(null);
  // React fires no blur for a focused row that unmounts, and every unmount
  // changes rows.
  useLayoutEffect(() => {
    if (focusIn && !list.current?.contains(document.activeElement)) {
      setFocusIn(false);
    }
  }, [focusIn, rows]);
  const listProps = {
    ref: list,
    onPointerEnter: () => setPointerIn(true),
    onPointerLeave: () => setPointerIn(false),
    onFocus: (e: FocusEvent) => setFocusIn(e.target.matches(":focus-visible")),
    onBlur: (e: FocusEvent) => {
      const to = e.relatedTarget;
      if (!(to instanceof Node && e.currentTarget.contains(to))) {
        setFocusIn(false);
      }
    },
  };
  return { rows, listProps };
}

const NeedsReplyPage = () => {
  const {
    data: members,
    isError,
    isRefetchError,
    error,
  } = useNeedsReplyAdmin();
  const { rows, listProps } = useHeldRows(members);
  useClockMinute();

  return (
    <div className="flex flex-col gap-4 p-5">
      <title>Needs reply - Admin</title>
      <div>
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-semibold">Needs reply</h1>
          <p role="status" className="text-sm text-zinc-600">
            {members &&
              (members.length > 0
                ? `${members.length} waiting`
                : "None waiting")}
          </p>
          <SectionRefreshError
            noun="texts needing a reply"
            isError={isRefetchError}
            className="mb-0"
          />
        </div>
        <p className="text-sm text-zinc-600">
          Members with a text no staff member has answered yet, longest waiting
          first. A member leaves the list once someone replies from their page
          or they opt out of texts, and comes back if that reply fails to send.
        </p>
      </div>
      <div {...listProps}>
        {!members ? (
          isError ? (
            <p role="alert" className="text-sm text-red-600">
              {adminRefusalMessage(
                error,
                "Couldn't load texts needing a reply.",
              )}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">Loading texts…</p>
          )
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No texts are waiting for a reply.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 border border-zinc-200 rounded">
            {rows.map(({ member, left }) => (
              <li key={member.userId}>
                <Link
                  to={href("/member/:userId", {
                    userId: String(member.userId),
                  })}
                  className="flex flex-col gap-0.5 px-3 py-2 hover:bg-zinc-50"
                >
                  <span className="flex justify-between gap-2 text-sm">
                    <span
                      className={cn("font-medium", left && "text-zinc-500")}
                    >
                      {member.name}
                    </span>
                    <span className={cn("text-zinc-600", left && "italic")}>
                      {left
                        ? "No longer waiting"
                        : `Waiting ${formatDistanceToNow(new Date(member.waitingSince))}`}
                    </span>
                  </span>
                  <span className="truncate text-sm text-zinc-600">
                    {member.lastMessageBody || "Sent an attachment"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NeedsReplyPage;
