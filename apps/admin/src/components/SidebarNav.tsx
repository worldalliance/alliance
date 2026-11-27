import { formatBadgeCount } from "@alliance/shared/lib/badgeCount";
import { cn } from "@alliance/shared/styles/util";
import { DropdownMenuContent } from "@alliance/sharedweb/ui/DropdownMenu";
import { Menu } from "@base-ui/react/menu";
import { ChevronDown, Ellipsis } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { navSections, type NavLink, type NavSection } from "./adminNavEntries";

const isOnPage = (pathname: string, to: string) =>
  pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));

const rowClass = (active: boolean) =>
  cn(
    "flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-100",
    "outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600",
    active
      ? "bg-white text-zinc-900 font-medium shadow-[0_0_0_1px_var(--color-zinc-200)]"
      : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900",
  );

const NotifBadge = ({ count }: { count?: number | null }) => {
  const label = count === null ? "!" : formatBadgeCount(count ?? 0);
  return label ? (
    <>
      <span
        aria-hidden
        className={cn(
          "ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white",
          count === null ? "bg-red-600" : "bg-zinc-900",
        )}
      >
        {label}
      </span>
      <span className="sr-only">
        {" "}
        ({count === null ? "count couldn't load" : label})
      </span>
    </>
  ) : null;
};

const NavLinkRow = ({ link, active }: { link: NavLink; active: boolean }) => (
  <Link
    to={link.to}
    aria-current={active ? "page" : undefined}
    data-current={active || undefined}
    className={rowClass(active)}
  >
    <span className="shrink-0" aria-hidden>
      {link.icon}
    </span>
    <span className="truncate">{link.label}</span>
    <NotifBadge count={link.notifCount} />
  </Link>
);

const MorePagesMenu = ({
  sectionLabel,
  pages,
  currentTo,
}: {
  sectionLabel: string;
  pages: NonNullable<NavSection["more"]>;
  currentTo: string | undefined;
}) => {
  const current = pages.find((page) => page.to === currentTo);
  const more = `More ${sectionLabel.toLowerCase()} pages`;
  const label = current ? `${current.label} (${more.toLowerCase()})` : more;
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        data-current={current !== undefined || undefined}
        className={rowClass(current !== undefined)}
      >
        <Ellipsis size={16} aria-hidden className="shrink-0" />
        <span className="truncate">{current?.label ?? "More"}</span>
        <ChevronDown size={14} aria-hidden className="ml-auto shrink-0" />
      </Menu.Trigger>
      <DropdownMenuContent className="min-w-48">
        {pages.map((page) => (
          <Menu.LinkItem
            key={page.to}
            render={<Link to={page.to} />}
            aria-current={page.to === currentTo ? "page" : undefined}
            closeOnClick
            className={cn(
              "flex rounded-md px-3 py-2 text-sm outline-hidden data-[highlighted]:bg-zinc-100",
              page.to === currentTo && "font-medium",
            )}
          >
            {page.label}
          </Menu.LinkItem>
        ))}
      </DropdownMenuContent>
    </Menu.Root>
  );
};

const SidebarNav = ({
  groupAssignmentCount,
  needsReplyCount,
  pendingOutreachPartnershipCount,
}: {
  groupAssignmentCount: number;
  needsReplyCount: number | null;
  pendingOutreachPartnershipCount: number;
}) => {
  const { pathname } = useLocation();
  const sections = navSections({
    groupAssignmentCount,
    needsReplyCount,
    pendingOutreachPartnershipCount,
  });
  // The longest match wins, so /invites/graph doesn't also mark /invites.
  const currentTo = sections
    .flatMap((section) => [...section.links, ...(section.more ?? [])])
    .map((page) => page.to)
    .filter((to) => isOnPage(pathname, to))
    .sort((a, b) => b.length - a.length)[0];
  // Every section is open, so a lower section's current row can start below
  // the fold.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current
      ?.querySelector("[data-current]")
      ?.scrollIntoView({ block: "nearest" });
  }, [currentTo]);

  return (
    <nav ref={navRef} aria-label="Admin" className="flex flex-col gap-y-4">
      {sections.map((section, index) => (
        <div
          key={section.label ?? index}
          role={section.label ? "group" : undefined}
          aria-label={section.label ?? undefined}
          className="flex flex-col gap-y-0.5"
        >
          {section.label && (
            <div
              aria-hidden
              className="px-2 pb-1 text-xs font-medium text-zinc-500"
            >
              {section.label}
            </div>
          )}
          {section.links.map((link) => (
            <NavLinkRow
              key={link.to}
              link={link}
              active={link.to === currentTo}
            />
          ))}
          {section.more && (
            <MorePagesMenu
              sectionLabel={section.label}
              pages={section.more}
              currentTo={currentTo}
            />
          )}
        </div>
      ))}
    </nav>
  );
};

export default SidebarNav;
