import { cn } from "@alliance/shared/styles/util";
import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  readOpenFolders,
  SidebarFolder,
  writeOpenFolders,
} from "../lib/sidebarFolders";
import {
  isFolder,
  navEntries,
  type NavFolder,
  type NavLink,
} from "./adminNavEntries";

const isOnPage = (pathname: string, to: string) =>
  pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));

const ROW =
  "flex items-center gap-2 text-[15px] text-gray-700 hover:text-black hover:bg-zinc-200/60 py-2 px-2 rounded transition-colors";

const NotifBadge = ({ count }: { count?: number }) =>
  count ? (
    <div className="font-semibold text-xs text-white bg-red-500 rounded-md flex justify-center items-center w-5 h-5">
      {count}
    </div>
  ) : null;

const NavLinkRow = ({ link, active }: { link: NavLink; active: boolean }) => (
  <Link
    to={link.to}
    aria-current={active ? "page" : undefined}
    className={cn(ROW, active && "bg-zinc-200 text-black font-medium")}
  >
    {link.icon}
    {link.label}
    <NotifBadge count={link.notifCount} />
  </Link>
);

const SidebarNav = ({
  groupAssignmentCount,
  pendingOutreachPartnershipCount,
}: {
  groupAssignmentCount: number;
  pendingOutreachPartnershipCount: number;
}) => {
  const { pathname } = useLocation();
  const [openFolders, setOpenFolders] = useState(readOpenFolders);

  const entries = navEntries({
    groupAssignmentCount,
    pendingOutreachPartnershipCount,
  });

  const currentFolder = entries.find(
    (entry): entry is NavFolder =>
      isFolder(entry) &&
      entry.links.some((link) => isOnPage(pathname, link.to)),
  )?.folder;

  const setFolderOpen = useCallback(
    (folder: SidebarFolder, open: boolean) =>
      setOpenFolders((prev) => {
        if (prev.has(folder) === open) return prev;
        const next = new Set(prev);
        if (open) {
          next.add(folder);
        } else {
          next.delete(folder);
        }
        return next;
      }),
    [],
  );

  useEffect(() => {
    if (currentFolder) setFolderOpen(currentFolder, true);
  }, [currentFolder, setFolderOpen]);

  useEffect(() => writeOpenFolders(openFolders), [openFolders]);

  return (
    <nav className="flex flex-col gap-y-1">
      {entries.map((entry) => {
        if (!isFolder(entry)) {
          return (
            <NavLinkRow
              key={entry.to}
              link={entry}
              active={isOnPage(pathname, entry.to)}
            />
          );
        }
        const open = openFolders.has(entry.folder);
        const Chevron = open ? ChevronDown : ChevronRight;
        return (
          <React.Fragment key={entry.folder}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setFolderOpen(entry.folder, !open)}
              className={cn(ROW, "w-full")}
            >
              <Chevron size={16} />
              {entry.label}
              {!open && (
                <NotifBadge
                  count={entry.links.reduce(
                    (sum, link) => sum + (link.notifCount ?? 0),
                    0,
                  )}
                />
              )}
            </button>
            {open && (
              <div className="flex flex-col gap-y-1 pl-4 border-l border-zinc-300 ml-2">
                {entry.links.map((link) => (
                  <NavLinkRow
                    key={link.to}
                    link={link}
                    active={isOnPage(pathname, link.to)}
                  />
                ))}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default SidebarNav;
