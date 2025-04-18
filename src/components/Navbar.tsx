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

interface NavbarProps {
  currentPage: NavbarPage;
}

const Navbar: React.FC<NavbarProps> = ({ currentPage }) => {
  return (
    <div className="flex flex-col font-itc w-[180px] bg-white border-r border-r-[#ddd] shadow-sm pl-[10px] h-screen text-left m-5 space-y-4 justify-center">
      <div className="absolute w-100 top-10 left-0 flex flex-row justify-center items-center w-[190px]">
        <Logo />
      </div>
      <p>
        <strong>Action Items</strong>
      </p>
      <p>Current Issues</p>
      <p>Announcements</p>
      <p>Forum</p>
      <p>People</p>
      <p>Platform</p>
      <p>Settings</p>
    </div>
  );
};

export default Navbar;
