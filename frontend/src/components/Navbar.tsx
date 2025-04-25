import React from "react";
import NavbarVertical from "./NavbarVertical";
import NavbarHorizontal from "./NavbarHorizontal";

export enum NavbarPage {
  Dashboard = "Dashboard",
  CurrentActions = "Current Actions",
  Announcements = "Announcements",
  Forum = "Forum",
  People = "People",
  Platform = "Platform",
  Settings = "Settings",
}

export const links: NavbarPage[] = [
  NavbarPage.Dashboard,
  NavbarPage.CurrentActions,
  NavbarPage.Announcements,
  NavbarPage.Forum,
  NavbarPage.People,
  NavbarPage.Platform,
];

export const destinations: Record<NavbarPage, string> = {
  [NavbarPage.Dashboard]: "/home",
  [NavbarPage.CurrentActions]: "/actions",
  [NavbarPage.Announcements]: "/announcements",
  [NavbarPage.Forum]: "/forum",
  [NavbarPage.People]: "/people",
  [NavbarPage.Platform]: "/platform",
  [NavbarPage.Settings]: "/settings",
};

export const platformSublinks = [
  { text: "Manifesto", to: "/platform/overview" },
  { text: "Organization", to: "/platform/features" },
  { text: "Roadmap", to: "/platform/docs" },
];

export interface NavbarProps {
  currentPage: NavbarPage;
  format?: "horizontal" | "vertical";
}

const Navbar: React.FC<NavbarProps> = ({ currentPage, format }) => {
  return (
    <div className="font-avenir text-[11pt] bg-white sticky top-0 z-10">
      {format === "vertical" ? (
        <NavbarVertical currentPage={currentPage} />
      ) : (
        <NavbarHorizontal currentPage={currentPage} />
      )}
    </div>
  );
};

export default Navbar;
