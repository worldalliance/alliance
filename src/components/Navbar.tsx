import React from "react";
import { Link } from "react-router-dom";
import Logo from "./Logo";

export enum NavbarPage {
  ActionItems = "Action Items",
  CurrentIssues = "Current Issues",
  Announcements = "Announcements",
  Forum = "Forum",
  People = "People",
  Platform = "Platform",
  Settings = "Settings",
}

export const links: NavbarPage[] = [
  NavbarPage.ActionItems,
  NavbarPage.CurrentIssues,
  NavbarPage.Announcements,
  NavbarPage.Forum,
  NavbarPage.People,
  NavbarPage.Platform,
];

export const destinations: Record<NavbarPage, string> = {
  [NavbarPage.ActionItems]: "/home",
  [NavbarPage.CurrentIssues]: "/issues",
  [NavbarPage.Announcements]: "/announcements",
  [NavbarPage.Forum]: "/forum",
  [NavbarPage.People]: "/people",
  [NavbarPage.Platform]: "/platform",
  [NavbarPage.Settings]: "/settings",
};

export interface NavbarProps {
  currentPage: NavbarPage;
}

const Navbar: React.FC<NavbarProps> = ({ currentPage }) => {
  return (
    <div className="flex flex-col font-itc w-[180px] bg-white border-r border-r-[#ddd] shadow-sm pl-[10px] h-screen text-left space-y-4 justify-center pl-6 sticky">
      <div className="absolute w-[100%] top-10 left-0 flex flex-row justify-center items-center">
        <Logo href="/" />
      </div>
      {links.map((link) => (
        <Link to={destinations[link]} key={link}>
          <p
            className={` p-2 m-0 ${
              currentPage === link ? "font-itc-bold bg-gray-100" : ""
            }`}
          >
            {link}
          </p>
        </Link>
      ))}
    </div>
  );
};

export default Navbar;
