import { Link } from "react-router-dom";
import { platformSublinks } from "./Navbar";
import DropdownLink from "./DropdownLink";

// const links = ["Platform", "About", "Join", "Log in"];

enum NavbarPage {
  Platform = "Platform",
  About = "About",
  Join = "Join",
  LogIn = "Login",
}

export const links: NavbarPage[] = [
  NavbarPage.Platform,
  NavbarPage.About,
  NavbarPage.Join,
  NavbarPage.LogIn,
];

export const destinations: Record<NavbarPage, string> = {
  [NavbarPage.Platform]: "/platform",
  [NavbarPage.About]: "/about",
  [NavbarPage.Join]: "/signup",
  [NavbarPage.LogIn]: "/login",
};

const NewNavbar: React.FC<{
  inverted: boolean;
  ref: React.RefObject<HTMLDivElement | null>;
}> = ({ inverted, ref }) => {
  return (
    <div
      className={`
      flex flex-col md:flex-row
      w-screen justify-between items-center px-20 fixed top-0 left-0 z-10 text-[14pt] transition-all duration-300 ${
        inverted
          ? "bg-white text-black py-3"
          : "bg-transparent py-10 text-white"
      }`}
      ref={ref}
    >
      <h1 className="font-bold font-berlingske text-[24pt]">the alliance</h1>
      <div className="flex flex-row space-x-12">
        {links.map((link) =>
          link === "About" ? (
            <DropdownLink
              key={link}
              text={link}
              to={"/about"}
              inverted={inverted}
              sublinks={platformSublinks}
            />
          ) : (
            <Link to={destinations[link]} key={link}>
              <p className="pt-1 whitespace-nowrap font-newsreader">{link}</p>
            </Link>
          )
        )}
      </div>
    </div>
  );
};

export default NewNavbar;
