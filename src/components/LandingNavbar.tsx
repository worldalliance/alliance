import { Link } from "react-router-dom";
import { links } from "./Navbar";
import { destinations } from "./Navbar";
import { platformSublinks } from "./Navbar";
import { NavbarPage } from "./Navbar";
import DropdownLink from "./DropdownLink";

const LandingNavbar = () => {
  return (
    <div
      className="
      flex flex-row border-b border-[#ddd]
    w-screen text-left space-x-10 items-center justify-evenly pl-6 sticky py-3 bg-stone-50"
    >
      <Link to="/">
        <p className="pt-1 whitespace-nowrap !text-[12pt] ">News</p>
      </Link>
      <Link to="/">
        <p className="pt-1 whitespace-nowrap !text-[12pt]">Issues</p>
      </Link>
      <Link to="/">
        <p className="pt-1 whitespace-nowrap !text-[14pt] font-font">
          The ALLIANCE
        </p>
      </Link>
      <Link to="/">
        <p className="pt-1 whitespace-nowrap !text-[12pt]">Platform</p>
      </Link>
      <Link to="/">
        <p className="pt-1 whitespace-nowrap !text-[12pt]">Join</p>
      </Link>
    </div>
  );
};

export default LandingNavbar;
