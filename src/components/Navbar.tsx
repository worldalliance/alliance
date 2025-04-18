import React from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

interface NavbarProps {
  isHomePage?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ isHomePage = false }) => {
  if (isHomePage) {
    // Simple version for home page
    return (
      <div className="navbar home-navbar">
        <img src="/assets/dotgrid-25H09-664520.png" alt="The Alliance Logo" />
        <h1>The Alliance</h1>
      </div>
    );
  }

  // Full sidebar version for dashboard page
  return (
    <div className="navbar sidebar">
      <img src="/assets/dotgrid-25H09-664520.png" alt="logo" className="logo" />
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
