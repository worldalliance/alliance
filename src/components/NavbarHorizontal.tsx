import { Link } from "react-router-dom";
import {
  destinations,
  links,
  NavbarProps,
  NavbarPage,
  platformSublinks,
} from "./Navbar";
import DropdownLink from "./DropdownLink";
import LandingNavbar from "./LandingNavbar";
export type InnerNavbarProps = Pick<NavbarProps, "currentPage">;

const NavbarHorizontal: React.FC<InnerNavbarProps> = ({ currentPage }) => {
  if (document.location.href.endsWith("#/")) {
    return <LandingNavbar />;
  }

  return (
    <div
      className="
      flex flex-row border-b border-[#ddd]
    w-screen text-left space-x-10 items-center justify-center pl-6 sticky"
    >
      {/* <Logo href="/" className="w-[22px]" /> */}
      {links.map((link) =>
        link === NavbarPage.Platform ? (
          <DropdownLink
            key={link}
            text={link}
            to={destinations[link]}
            sublinks={platformSublinks}
          />
        ) : (
          <Link to={destinations[link]} key={link} className="py-3">
            <p className="pt-1 whitespace-nowrap">{link}</p>
          </Link>
        )
      )}
    </div>
  );
};

export default NavbarHorizontal;
