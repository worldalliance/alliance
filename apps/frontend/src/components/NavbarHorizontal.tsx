import { Link } from "react-router";
import { destinations, links, NavbarPage, platformSublinks } from "./Navbar";
import DropdownLink from "./DropdownLink";
import { Features } from "@alliance/shared/lib/features";
import { isFeatureEnabled } from "../lib/config";
import NotificationsIcon from "./NotificationsIcon";
import { useAuth } from "../lib/AuthContext";
const NavbarHorizontal: React.FC = () => {
  const activeLinks = isFeatureEnabled(Features.Forum)
    ? links
    : links.filter((link) => link !== NavbarPage.Forum);

  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return null;
  }

  let profileUrl = "/profile";
  if (user?.id) {
    profileUrl = `/user/${user.id}`;
  }

  return (
    <div
      className="
      flex flex-row border-stone-300 border-b
    w-screen text-left space-x-10 items-center pl-10 sticky justify-center z-10"
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
            <Link
              to={link === NavbarPage.Profile ? profileUrl : destinations[link]}
              key={link}
              className="py-3"
            >
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
