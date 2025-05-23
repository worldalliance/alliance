import React from "react";
import NavbarVertical from "./NavbarVertical";
import NavbarHorizontal from "./NavbarHorizontal";

export enum NavbarPage {
  Dashboard = "Dashboard",
  CurrentActions = "Current Actions",
  Announcements = "Announcements",
  Forum = "Forum",
  Profile = "Profile",
  Platform = "Platform",
  Settings = "Settings",
}

export const links: NavbarPage[] = [
  NavbarPage.Dashboard,
  NavbarPage.CurrentActions,
  NavbarPage.Announcements,
  NavbarPage.Forum,
  NavbarPage.Settings,
];

export const destinations: Record<NavbarPage, string> = {
  [NavbarPage.Dashboard]: "/home",
  [NavbarPage.CurrentActions]: "/actions",
  [NavbarPage.Announcements]: "/announcements",
  [NavbarPage.Forum]: "/forum",
  [NavbarPage.Profile]: "/profile",
  [NavbarPage.Platform]: "/platform",
  [NavbarPage.Settings]: "/settings",
};

export const platformSublinks = [
  { text: "About", to: "/about" },
  { text: "Resources", to: "/resources" },
  { text: "Governance", to: "/platform/governance" },
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
