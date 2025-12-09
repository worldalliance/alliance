import { Link, href, useNavigate } from "react-router";
import { useAuth } from "../lib/AuthContext";

enum NavbarPage {
  People = "People",
  Guide = "Guide",
  Progress = "Progress",
  LogIn = "Log In",
}

const links: NavbarPage[] = [
  NavbarPage.People,
  NavbarPage.Guide,
  NavbarPage.Progress,
  NavbarPage.LogIn,
];

interface PrelaunchNavbarProps {
  transparent?: boolean;
  absolute?: boolean;
  ref?: React.RefObject<HTMLDivElement | null>;
}

const PrelaunchNavbar: React.FC<PrelaunchNavbarProps> = ({
  transparent = true,
  absolute = true,
  ref,
}: PrelaunchNavbarProps) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const destinations: Record<NavbarPage, string> = {
    [NavbarPage.People]: href("/people"),
    [NavbarPage.Guide]: href("/guide"),
    [NavbarPage.Progress]: href("/progress"),
    [NavbarPage.LogIn]: isAuthenticated ? href("/tasks") : href("/login"),
  };

  return (
    <div
      className={`
      flex flex-col sm:flex-row md:gap-y-4 ${absolute ? "absolute" : "relative"}
      w-screen justify-between items-center py-4 md:py-5 px-24 top-0 left-0 z-10 text-[14pt] transition-[padding,background-color] duration-300 ${
        transparent
          ? "bg-transparent text-white"
          : "text-black bg-white border-b md:border-none border-zinc-200"
      }`}
      ref={ref}
    >
      <h1
        className="font-bold font-berlingske text-lg md:text-2xl cursor-pointer text-nowrap"
        onClick={() => {
          navigate(href("/"));
        }}
      >
        THE ALLIANCE
      </h1>
      <div className="flex flex-row items-center gap-x-5 sm:gap-x-10 text-base sm:text-lg">
        {links.map((link) => (
          <Link
            to={destinations[link]}
            key={link}
            className="hover:underline whitespace-nowrap"
          >
            {link}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default PrelaunchNavbar;
