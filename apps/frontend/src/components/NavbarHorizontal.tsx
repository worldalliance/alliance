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
import { Features } from "@alliance/shared/lib/features";
import { isFeatureEnabled } from "../lib/config";
import NotificationsIcon from "./NotificationsIcon";

export type InnerNavbarProps = Pick<NavbarProps, "currentPage">;

const NavbarHorizontal: React.FC<InnerNavbarProps> = () => {
  if (document.location.href.endsWith("#/")) {
    return <LandingNavbar />;
  }

  const activeLinks = isFeatureEnabled(Features.Forum)
    ? links
    : links.filter((link) => link !== NavbarPage.Forum);

  return (
    <div
      className="
      flex flex-row border-stone-300 border-b
    w-screen text-left space-x-10 items-center pl-10 sticky justify-center"
    >
      {/* <Link to="/">
        <h1 className="font-bold font-berlingske !text-[16pt] cursor-pointer">
          alliance
        </h1>
      </Link> */}
      <div className="flex flex-row gap-x-10 px-10">
        {activeLinks.map((link) =>
          link === NavbarPage.Platform ? (
            <DropdownLink
              key={link}
              text={link}
              to={destinations[link]}
              sublinks={platformSublinks}
              inverted={false}
            />
          ) : (
            <Link to={destinations[link]} key={link} className="py-3">
              <p className="pt-1 whitespace-nowrap">{link}</p>
            </Link>
          )
        )}
      </div>
      <div className="absolute right-10">
        <NotificationsIcon />
      </div>
    </div>
  );
};

export default NavbarHorizontal;
