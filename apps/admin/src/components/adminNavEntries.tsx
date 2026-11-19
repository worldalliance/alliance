import {
  AudioLines,
  BarChart2,
  Building2,
  Calendar,
  CirclePile,
  Contact,
  FileText,
  Film,
  FolderKanban,
  HandHeart,
  Handshake,
  Link as LinkIcon,
  ListChecks,
  ListOrdered,
  Map,
  Megaphone,
  MessageSquare,
  MessageSquareReply,
  MessagesSquare,
  Network,
  Newspaper,
  Plane,
  Radio,
  ScrollText,
  Smartphone,
  SquareActivity,
  UserPlus,
  Users,
  Waypoints,
} from "lucide-react";
import type React from "react";
import type { SearchPage } from "../lib/adminSearch";

export type NavLink = {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** null when the count couldn't load. */
  notifCount?: number | null;
};

export type NavSection =
  | { label: null; links: NavLink[]; more?: never }
  | { label: string; links: NavLink[]; more?: { to: string; label: string }[] };

export const navSections = (counts: {
  groupAssignmentCount: number;
  needsReplyCount: number | null;
  pendingOutreachPartnershipCount: number;
}): NavSection[] => [
  {
    label: null,
    links: [
      { to: "/", label: "Stats", icon: <BarChart2 size={16} /> },
      {
        to: "/needs-reply",
        label: "Needs reply",
        icon: <MessageSquareReply size={16} />,
        notifCount: counts.needsReplyCount,
      },
      { to: "/texts", label: "Texts", icon: <Smartphone size={16} /> },
    ],
  },
  {
    label: "Work",
    links: [
      { to: "/projects", label: "Projects", icon: <FolderKanban size={16} /> },
      { to: "/actions", label: "Actions", icon: <SquareActivity size={16} /> },
      { to: "/priority", label: "Priority", icon: <ListOrdered size={16} /> },
      {
        to: "/scheduled",
        label: "Scheduled plans",
        icon: <Calendar size={16} />,
      },
      { to: "/contracts", label: "Contracts", icon: <FileText size={16} /> },
      {
        to: "/kora-participants",
        label: "Kora participants",
        icon: <AudioLines size={16} />,
      },
    ],
    more: [
      { to: "/forms", label: "Forms" },
      { to: "/formulas", label: "Formulas" },
      { to: "/member-lists", label: "Member lists" },
    ],
  },
  {
    label: "People",
    links: [
      { to: "/members", label: "Members", icon: <Users size={16} /> },
      {
        to: "/groups",
        label: "Groups",
        icon: <CirclePile size={16} />,
        notifCount: counts.groupAssignmentCount,
      },
      { to: "/waitlist", label: "Waitlist", icon: <ListChecks size={16} /> },
      {
        to: "/welcome-queue",
        label: "Welcome queue",
        icon: <MessageSquare size={16} />,
      },
      { to: "/away", label: "Away members", icon: <Plane size={16} /> },
      {
        to: "/staff-directory",
        label: "Staff directory",
        icon: <Contact size={16} />,
      },
    ],
    more: [
      { to: "/members/tags", label: "Member tags" },
      { to: "/waitlist-emails", label: "Waitlist emails" },
    ],
  },
  {
    label: "Growth",
    links: [
      { to: "/invites", label: "Invites", icon: <UserPlus size={16} /> },
      {
        to: "/invite-links",
        label: "Invite links",
        icon: <LinkIcon size={16} />,
      },
      {
        to: "/ambassador-program",
        label: "Ambassador program",
        icon: <HandHeart size={16} />,
      },
      {
        to: "/outreach-partnerships",
        label: "Outreach partnerships",
        icon: <Handshake size={16} />,
        notifCount: counts.pendingOutreachPartnershipCount,
      },
      {
        to: "/organizations",
        label: "Organizations",
        icon: <Building2 size={16} />,
      },
    ],
    more: [
      { to: "/invite-message-template", label: "Invitation message" },
      { to: "/invites/graph", label: "Invite graph" },
      { to: "/custom-links", label: "Custom links" },
      { to: "/share-links", label: "Share links" },
      { to: "/share-targets", label: "Share targets" },
    ],
  },
  {
    label: "Content",
    links: [
      {
        to: "/action-updates",
        label: "Action updates",
        icon: <Megaphone size={16} />,
      },
      {
        to: "/general-updates",
        label: "General updates",
        icon: <Newspaper size={16} />,
      },
      {
        to: "/posts",
        label: "Forum posts",
        icon: <MessagesSquare size={16} />,
      },
      { to: "/videos", label: "Videos", icon: <Film size={16} /> },
    ],
    more: [
      { to: "/hosted-docs", label: "Hosted docs" },
      { to: "/image", label: "Image upload" },
      { to: "/test-push", label: "Test push notification" },
    ],
  },
  {
    label: "Insights",
    links: [
      { to: "/event-log", label: "Event log", icon: <ScrollText size={16} /> },
      {
        to: "/invite-feed",
        label: "Live invite feed",
        icon: <Radio size={16} />,
      },
      { to: "/member-map", label: "Member map", icon: <Map size={16} /> },
      { to: "/clusters", label: "Clusters", icon: <Network size={16} /> },
      {
        to: "/friend-graph",
        label: "Friend graph",
        icon: <Waypoints size={16} />,
      },
    ],
  },
];

export const searchPages = (): SearchPage[] =>
  navSections({
    groupAssignmentCount: 0,
    needsReplyCount: 0,
    pendingOutreachPartnershipCount: 0,
  }).flatMap((section) =>
    [...section.links, ...(section.more ?? [])].map((link) => ({
      label: link.label,
      section: section.label,
      to: link.to,
    })),
  );
