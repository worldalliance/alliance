import { Link, useNavigate } from "react-router";
import Navbar, { platformSublinks } from "./Navbar";
import DropdownLink from "./DropdownLink";

enum NavbarPage {
  Updates = "Updates",
  Platform = "Platform",
  Join = "Join",
}

export const links: NavbarPage[] = [
  NavbarPage.Updates,
  NavbarPage.Platform,
  NavbarPage.Join,
];

export const destinations: Record<NavbarPage, string> = {
  [NavbarPage.Updates]: "/updates",
  [NavbarPage.Platform]: "/about",
  [NavbarPage.Join]: "/signup",
};

const NewNavbar: React.FC<{
  transparent?: boolean;
  ref?: React.RefObject<HTMLDivElement | null>;
}> = ({ transparent = false, ref }) => {
  const navigate = useNavigate();
  return (
    <div
      className={`
      flex flex-col md:flex-row gap-y-4
      w-screen justify-between items-center px-24 sticky top-0 left-0 z-10 text-[14pt] transition-[padding,background-color] duration-300 ${
        transparent
          ? "bg-transparent py-10 text-white"
          : "bg-black text-white py-6"
      }`}
      ref={ref}
    >
      <h1
        className="font-bold font-berlingske text-[24pt] cursor-pointer"
        onClick={() => {
          navigate("/");
        }}
      >
        THE ALLIANCE
      </h1>
      <div className="flex flex-row items-center gap-x-14">
        {links.map((link) =>
          link === NavbarPage.Platform ? (
            <DropdownLink
              key={link}
              text={link}
              to={"/resources"}
              inverted={!transparent}
              sublinks={platformSublinks}
            />
          ) : link == NavbarPage.Join ? (
            <Link to={destinations[link]} key={link}>
              <p
                className={`${
                  transparent
                    ? "border border-white/100 hover:bg-white hover:text-black"
                    : "border border-white hover:bg-white hover:text-black"
                } rounded-md py-1 px-4 whitespace-nowrap font-newsreader`}
              >
                Join
              </p>
            </Link>
          ) : (
            <Link to={destinations[link]} key={link}>
              <p className="hover:underline whitespace-nowrap font-newsreader">
                {link}
              </p>
            </Link>
          )
        )}
      </div>
    </div>
  );
};

export default NewNavbar;
