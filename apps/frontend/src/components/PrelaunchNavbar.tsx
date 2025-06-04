import { Link, useNavigate } from "react-router";
import { platformSublinks } from "./Navbar";
import DropdownLink from "./DropdownLink";

enum NavbarPage {
  Names = "Names",
  Platform = "Platform",
  Help = "Help",
}

export const links: NavbarPage[] = [
  NavbarPage.Names,
  NavbarPage.Platform,
  NavbarPage.Help,
];

export const destinations: Record<NavbarPage, string> = {
  [NavbarPage.Names]: "/names",
  [NavbarPage.Platform]: "/about",
  [NavbarPage.Help]: "/help",
};

export interface PrelaunchNavbarProps {
  transparent?: boolean;
  ref?: React.RefObject<HTMLDivElement | null>;
}

const PrelaunchNavbar: React.FC<PrelaunchNavbarProps> = ({
  transparent = true,
  ref,
}: PrelaunchNavbarProps) => {
  const navigate = useNavigate();
  return (
    <div
      className={`
      flex flex-col md:flex-row gap-y-4 absolute
      w-screen justify-between items-center px-24 top-0 left-0 z-10 text-[14pt] transition-[padding,background-color] duration-300 ${
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
          ) : link == NavbarPage.Help ? (
            <Link to={destinations[link]} key={link}>
              <p
                className={`${
                  transparent
                    ? "border border-white/100 hover:bg-white hover:text-black"
                    : "border border-white hover:bg-white hover:text-black"
                } rounded-md py-1 px-4 whitespace-nowrap font-newsreader`}
              >
                Help
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

export default PrelaunchNavbar;
