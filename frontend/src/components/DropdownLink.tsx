import { Link } from "react-router-dom";
import React, { useState } from "react";
import dropDownArrow from "../assets/icons8-expand-arrow-96.png";
import { platformSublinks } from "./Navbar";

interface DropdownLinkProps {
  text: string;
  to: string;
  sublinks: typeof platformSublinks;
}

const DropdownLink: React.FC<DropdownLinkProps> = ({ text, to, sublinks }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative py-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-row items-center space-x-2 h-full after:content-[''] after:absolute after:top-0 after:left-0 after:w-full after:h-[150%] after:bg-transparent after:z-10">
        <Link to={to}>
          <p className="pt-1 whitespace-nowrap">{text}</p>
        </Link>
        <img
          src={dropDownArrow}
          alt="dropdown arrow"
          className="w-[10px]"
        ></img>
      </div>
      {isHovered && (
        <div className="absolute top-full left-0 bg-white shadow-md rounded-b-md py-2 mt-n1 z-10 min-w-[150px]">
          {sublinks.map((sublink, index) => (
            <Link
              to={sublink.to}
              key={index}
              className="block px-4 py-2 hover:bg-gray-100"
            >
              {sublink.text}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default DropdownLink;
