import { cn } from "@alliance/shared/styles/util";
import React, { useState } from "react";
import { Link } from "react-router";
import dropDownArrow from "../assets/icons8-expand-arrow-96.png";

interface DropdownLinkProps {
  text: string;
  to: string;
  sublinks: Array<{ to: string; text: string }>;
  inverted: boolean;
}

const DropdownLink: React.FC<DropdownLinkProps> = ({
  text,
  to,
  sublinks,
  inverted,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-row items-center space-x-2 h-full after:content-[''] after:absolute after:top-0 after:left-0 after:w-full after:h-[150%] after:bg-transparent after:z-10">
        <Link to={to}>
          <p className="whitespace-nowrap">{text}</p>
        </Link>
        <img
          src={dropDownArrow}
          alt="dropdown arrow"
          className="w-[15px]"
          // style={{ filter: inverted ? "invert(0)" : "invert(1)" }}
          style={{ filter: "invert(1)" }}
        ></img>
      </div>
      {isHovered && (
        <div
          className={cn(
            "absolute top-full left-0 rounded-b-md z-10 min-w-[150px] ml-[-17px] pt-3",
            inverted ? "bg-black" : "bg-transparent",
          )}
        >
          {sublinks.map((sublink, index) => (
            <Link
              to={sublink.to}
              key={index}
              className="block px-4 py-2 hover:underline text-[13pt]"
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
