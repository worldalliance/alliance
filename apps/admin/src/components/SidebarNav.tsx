import { cn } from "@alliance/shared/styles/util";
import {
  BarChart2,
  Calendar,
  ChevronDown,
  ChevronRight,
  CirclePile,
  FileText,
  Film,
  Handshake,
  ImageUp,
  ListOrdered,
  MailPlus,
  Map,
  MessageSquare,
  Network,
  Newspaper,
  Radio,
  ScrollText,
  Share2,
  SquareActivity,
  SquareMousePointer,
  UserPlus,
  Users,
  Waypoints,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  readOpenFolders,
  SidebarFolder,
  writeOpenFolders,
} from "../lib/sidebarFolders";

type NavLink = {
  to: string;
  label: string;
  icon: React.ReactNode;
  notifCount?: number;
};

type NavFolder = {
  folder: SidebarFolder;
  label: string;
  links: NavLink[];
};

type NavEntry = NavLink | NavFolder;

const isFolder = (entry: NavEntry): entry is NavFolder => "folder" in entry;

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

  const entries: NavEntry[] = [
    { to: "/", label: "Stats", icon: <BarChart2 size={16} /> },
    { to: "/actions", label: "Actions", icon: <SquareActivity size={16} /> },
    {
      folder: SidebarFolder.ActionPlanning,
      label: "Action Planning",
      links: [
        { to: "/priority", label: "Priority", icon: <ListOrdered size={16} /> },
        {
          to: "/scheduled",
          label: "Scheduled Plans",
          icon: <Calendar size={16} />,
        },
        { to: "/contracts", label: "Contracts", icon: <FileText size={16} /> },
      ],
    },
    {
      folder: SidebarFolder.Activity,
      label: "Activity",
      links: [
        {
          to: "/invite-feed",
          label: "Live Invite Feed",
          icon: <Radio size={16} />,
        },
        {
          to: "/event-log",
          label: "Event Log",
          icon: <ScrollText size={16} />,
        },
      ],
    },
    {
      folder: SidebarFolder.InvitesSharing,
      label: "Invites & Sharing",
      links: [
        { to: "/invites", label: "User Invites", icon: <UserPlus size={16} /> },
        {
          to: "/invite-message-template",
          label: "Invitation Message",
          icon: <MailPlus size={16} />,
        },
        {
          to: "/share-links",
          label: "Share Links",
          icon: <Share2 size={16} />,
        },
        {
          to: "/share-targets",
          label: "Share Targets",
          icon: <SquareMousePointer size={16} />,
        },
      ],
    },
    { to: "/members", label: "Members", icon: <Users size={16} /> },
    {
      to: "/groups",
      label: "Groups",
      icon: <CirclePile size={16} />,
      notifCount: groupAssignmentCount,
    },
    {
      folder: SidebarFolder.Community,
      label: "Community",
      links: [
        {
          to: "/welcome-queue",
          label: "Welcome Queue",
          icon: <MessageSquare size={16} />,
        },
        {
          to: "/staff-directory",
          label: "Staff Directory",
          icon: <Users size={16} />,
        },
        { to: "/member-map", label: "Member Map", icon: <Map size={16} /> },
        { to: "/clusters", label: "Clusters", icon: <Network size={16} /> },
        {
          to: "/friend-graph",
          label: "Friend Graph",
          icon: <Waypoints size={16} />,
        },
      ],
    },
    {
      folder: SidebarFolder.Outreach,
      label: "Outreach",
      links: [
        {
          to: "/ambassador-program",
          label: "Ambassador Program",
          icon: <Handshake size={16} />,
        },
        {
          to: "/outreach-partnerships",
          label: "Outreach Partnerships",
          icon: <Handshake size={16} />,
          notifCount: pendingOutreachPartnershipCount,
        },
      ],
    },
    {
      folder: SidebarFolder.Content,
      label: "Content",
      links: [
        {
          to: "/general-updates",
          label: "General Updates",
          icon: <Newspaper size={16} />,
        },
        {
          to: "/posts",
          label: "Forum Posts",
          icon: <MessageSquare size={16} />,
        },
        { to: "/image", label: "Image Upload", icon: <ImageUp size={16} /> },
        { to: "/videos", label: "Videos", icon: <Film size={16} /> },
      ],
    },
  ];

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
