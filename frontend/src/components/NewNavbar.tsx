import { Link, useNavigate } from "react-router-dom";
import { platformSublinks } from "./Navbar";
import DropdownLink from "./DropdownLink";

// const links = ["Platform", "About", "Join", "Log in"];

enum NavbarPage {
  Platform = "Platform",
  Join = "Join",
  LogIn = "Login",
}

export const links: NavbarPage[] = [
  NavbarPage.Platform,
  NavbarPage.Join,
  NavbarPage.LogIn,
];

export const destinations: Record<NavbarPage, string> = {
  [NavbarPage.Platform]: "/platform",
  [NavbarPage.Join]: "/signup",
  [NavbarPage.LogIn]: "/login",
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
      w-screen justify-between items-center px-20 fixed top-0 left-0 z-10 text-[14pt] transition-[padding,background-color] duration-300 ${
        transparent
          ? "bg-transparent py-10 text-white"
          : "bg-white text-black py-3"
      }`}
      ref={ref}
    >
      <h1
        className="font-bold font-berlingske text-[24pt] cursor-pointer"
        onClick={() => {
          navigate("/");
        }}
      >
        the alliance
      </h1>
      <div className="flex flex-row gap-x-16">
        {links.map((link) =>
          link === NavbarPage.Platform ? (
            <DropdownLink
              key={link}
              text={link}
              to={"/about"}
              inverted={!transparent}
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
