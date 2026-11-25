import { isProduction } from "@alliance/sharedweb/lib/config";
import { memberPathFor } from "@alliance/sharedweb/lib/zoneLinks";
import {
  LayoutGrid,
  LogOut,
  type LucideIcon,
  PanelLeft,
  Settings,
  SquareArrowOutUpRight,
} from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { legacyPathFor } from "../legacyRoutes";
import { getSiteUrl } from "../lib/config";
import {
  activeRailEntry,
  type CountId,
  placeById,
  PlaceId,
  RAIL,
  RAIL_QUEUES,
  type RailEntry,
  railHref,
} from "../places";
import { AvatarProfile } from "../ui/Avatar";
import Badge, { BadgeTone } from "../ui/Badge";
import { cn } from "../ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/DropdownMenu";
import { Kbd } from "../ui/Kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/Tooltip";
import { CountBadge } from "./CountBadge";
import { PLACE_ICONS } from "./placeIcons";
import type { QueueCount } from "./useQueueCounts";

const ROW =
  "relative flex h-control w-full shrink-0 items-center rounded-md pr-2 text-left font-medium text-fg transition-colors duration-fast focus-ring hover:bg-line";

/**
 * One entry of the sidebar. Its icon sits in a column the collapsed sidebar is
 * exactly as wide as, so collapsing hides the label without moving the icon.
 */
function Row({
  element,
  icon: Icon,
  label,
  expanded,
  active = false,
  count,
  trailing,
}: {
  /** The link or button the row is. */
  element: ReactElement<Record<string, unknown>>;
  icon: LucideIcon | (() => ReactNode);
  label: string;
  expanded: boolean;
  active?: boolean;
  count?: QueueCount;
  trailing?: ReactNode;
}) {
  return (
    <Tooltip disabled={expanded}>
      <TooltipTrigger
        render={element}
        className={cn(ROW, active && "bg-surface inset-ring inset-ring-line")}
      >
        <span
          className={cn(
            "flex w-10 shrink-0 justify-center",
            active ? "text-accent" : "text-fg-muted",
          )}
        >
          <Icon className="size-4.5" aria-hidden />
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate transition-opacity duration-base",
            !expanded && "opacity-0",
          )}
        >
          {label}
        </span>
        <CountBadge
          count={count}
          className={cn(
            !expanded &&
              "absolute -top-1 right-0 h-4 min-w-4 px-1 ring-2 ring-surface-2",
          )}
        />
        {expanded && trailing}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export type SidebarUser = {
  name: string;
  email: string;
  profilePicture: string | null;
};

function AccountMenu({
  expanded,
  user,
  onSignOut,
}: {
  expanded: boolean;
  user: SidebarUser | undefined;
  onSignOut: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account: ${user?.name ?? "signed in"}`}
        title={expanded ? undefined : user?.name}
        className={cn(ROW, "h-auto min-h-control py-1")}
      >
        <span className="flex w-10 shrink-0 justify-center">
          <AvatarProfile
            pfp={user?.profilePicture ?? null}
            size="small"
            alt=""
          />
        </span>
        <span
          className={cn(
            "flex min-w-0 flex-1 flex-col transition-opacity duration-base",
            !expanded && "opacity-0",
          )}
        >
          <span className="truncate">{user?.name}</span>
          <span className="truncate text-caption font-normal text-fg-muted">
            {user?.email}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuItem
          render={<Link to={placeById(PlaceId.Settings).path} />}
        >
          <Settings className="size-4 text-fg-muted" aria-hidden />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut className="size-4 text-fg-muted" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Sidebar({
  expanded,
  onToggle,
  onOpenPalette,
  counts,
  user,
  onSignOut,
}: {
  expanded: boolean;
  onToggle: () => void;
  onOpenPalette: () => void;
  counts: Record<CountId, QueueCount>;
  /** Undefined until the session has loaded. */
  user: SidebarUser | undefined;
  onSignOut: () => void;
}) {
  const location = useLocation();
  const active = activeRailEntry(location);
  const production = isProduction();
  const toggleLabel = expanded ? "Collapse sidebar" : "Expand sidebar";

  const entryRow = (entry: RailEntry) => (
    <Row
      key={entry.label}
      element={
        <Link
          to={railHref(entry)}
          aria-current={entry === active ? "page" : undefined}
        />
      }
      icon={PLACE_ICONS[entry.place]}
      label={entry.label}
      expanded={expanded}
      active={entry === active}
      count={entry.count && counts[entry.count]}
    />
  );

  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden border-r border-line bg-surface-2 transition-[width] duration-slow ease-standard",
        expanded ? "w-60" : "w-14",
      )}
    >
      <div className="flex h-14 shrink-0 items-center px-2">
        <Tooltip>
          <TooltipTrigger
            render={<button type="button" onClick={onToggle} />}
            aria-label={toggleLabel}
            aria-expanded={expanded}
            className="flex h-control w-10 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors duration-fast focus-ring hover:bg-line hover:text-fg"
          >
            <PanelLeft className="size-4.5" aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="right">{toggleLabel}</TooltipContent>
        </Tooltip>
        <Link
          to="/"
          inert={!expanded}
          className={cn(
            "min-w-0 flex-1 truncate rounded-sm px-1 font-semibold transition-opacity duration-base focus-ring",
            production ? "text-danger" : "text-fg",
            !expanded && "opacity-0",
          )}
        >
          Alliance admin
        </Link>
      </div>
      {production && (
        <div className="flex h-7 shrink-0 items-start justify-center px-2">
          <Badge tone={BadgeTone.Danger} className="self-auto">
            {expanded ? "Production" : <abbr title="Production">Prod</abbr>}
          </Badge>
        </div>
      )}
      <nav
        aria-label="Main"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto px-2 pb-2"
      >
        {RAIL.map(entryRow)}
        <div className="flex h-9 shrink-0 items-end px-3 pb-1.5">
          {expanded ? (
            <h2 className="text-caption font-medium text-fg-muted">Queues</h2>
          ) : (
            <span className="mb-1.5 h-px flex-1 bg-line" />
          )}
        </div>
        {RAIL_QUEUES.map(entryRow)}
      </nav>
      <div className="flex shrink-0 flex-col gap-0.5 border-t border-line p-2">
        <Row
          element={<button type="button" onClick={onOpenPalette} />}
          icon={LayoutGrid}
          label="All pages and search"
          expanded={expanded}
          trailing={<Kbd>⌘K</Kbd>}
        />
        <Row
          element={
            <a
              href={`${getSiteUrl()}${memberPathFor(legacyPathFor(location))}`}
            />
          }
          icon={SquareArrowOutUpRight}
          label="Open in member zone"
          expanded={expanded}
        />
        <AccountMenu expanded={expanded} user={user} onSignOut={onSignOut} />
      </div>
    </aside>
  );
}
