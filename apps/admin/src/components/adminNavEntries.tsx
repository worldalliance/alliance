import {
  BarChart2,
  Building2,
  Calendar,
  CirclePile,
  FileText,
  Film,
  Handshake,
  ImageUp,
  Link as LinkIcon,
  ListChecks,
  ListOrdered,
  Mail,
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
import type React from "react";
import type { SearchPage } from "../lib/adminSearch";
import { SidebarFolder } from "../lib/sidebarFolders";

export type NavLink = {
  to: string;
  label: string;
  icon: React.ReactNode;
  notifCount?: number;
};

export type NavFolder = {
  folder: SidebarFolder;
  label: string;
  links: NavLink[];
};

export type NavEntry = NavLink | NavFolder;

export const isFolder = (entry: NavEntry): entry is NavFolder =>
  "folder" in entry;

export const navEntries = (counts: {
  groupAssignmentCount: number;
  pendingOutreachPartnershipCount: number;
}): NavEntry[] => [
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
    label: "Links",
    links: [
      {
        to: "/custom-links",
        label: "Custom Links",
        icon: <LinkIcon size={16} />,
      },
      {
        to: "/hosted-docs",
        label: "Hosted Docs",
        icon: <FileText size={16} />,
      },
      {
        to: "/invite-links",
        label: "Invite Links",
        icon: <LinkIcon size={16} />,
      },
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
  {
    folder: SidebarFolder.Waitlist,
    label: "Waitlist",
    links: [
      { to: "/waitlist", label: "Entries", icon: <ListChecks size={16} /> },
      { to: "/waitlist-emails", label: "Emails", icon: <Mail size={16} /> },
      {
        to: "/organizations",
        label: "Organizations",
        icon: <Building2 size={16} />,
      },
    ],
  },
  { to: "/members", label: "Members", icon: <Users size={16} /> },
  {
    to: "/groups",
    label: "Groups",
    icon: <CirclePile size={16} />,
    notifCount: counts.groupAssignmentCount,
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
        notifCount: counts.pendingOutreachPartnershipCount,
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

export const searchPages = (): SearchPage[] =>
  navEntries({
    groupAssignmentCount: 0,
    pendingOutreachPartnershipCount: 0,
  }).flatMap<SearchPage>((entry) =>
    isFolder(entry)
      ? entry.links.map((link) => ({
          label: link.label,
          folder: entry.label,
          to: link.to,
        }))
      : [{ label: entry.label, folder: null, to: entry.to }],
  );
