import { Link, href, useNavigate } from "react-router";
import { useAuth } from "../lib/AuthContext";
import { cn } from "@alliance/shared/styles/util";

enum NavbarPage {
  People = "People",
  Guide = "Guide",
  Progress = "Progress",
  LogIn = "Log in",
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
  showLogo?: boolean;
  ref?: React.RefObject<HTMLDivElement | null>;
  showSignupButton?: boolean;
  signupHref?: string;
}

const PrelaunchNavbar: React.FC<PrelaunchNavbarProps> = ({
  transparent = true,
  absolute = true,
  showLogo = true,
  ref,
  showSignupButton = false,
  signupHref = href("/signup"),
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
      className={cn(
        "flex flex-col items-center",
        "sm:flex-row md:gap-y-4 py-4 md:py-5 px-24",
        "top-0 left-0 z-10 text-[14pt] transition-[padding,background-color] duration-300",
        absolute ? "absolute" : "relative",
        "w-screen",
        showLogo ? "justify-between" : "justify-end",
        transparent ? "bg-transparent text-white" : "text-black bg-white",
      )}
      ref={ref}
    >
      {showLogo && (
        <h1
          className={cn(
            "font-bold font-berlingske text-lg md:text-2xl cursor-pointer text-nowrap",
            transparent ? "text-white" : undefined,
          )}
          onClick={() => {
            navigate(href("/"));
          }}
        >
          THE ALLIANCE
        </h1>
      )}
      <div className="flex flex-row items-center gap-x-5 sm:gap-x-10 text-base sm:text-lg">
        {links.map((link) =>
          link === NavbarPage.LogIn ? (
            <div key={link} className="flex flex-row items-center gap-x-3">
              <Link
                to={destinations[link]}
                className={cn(
                  "py-1 md:py-1.5 px-3 md:px-5 rounded-full whitespace-nowrap font-medium",
                  transparent
                    ? "bg-white text-black hover:bg-zinc-100"
                    : "bg-black text-white hover:bg-zinc-800",
                )}
              >
                {link}
              </Link>
              {showSignupButton && (
                <Link
                  to={signupHref}
                  className={cn(
                    "py-1 md:py-1.5 px-3 md:px-5 rounded-full whitespace-nowrap font-medium",
                    transparent
                      ? "bg-green text-white hover:bg-[#4d8c1d]"
                      : "bg-green text-white hover:bg-[#4d8c1d]",
                  )}
                >
                  Sign up
                </Link>
              )}
            </div>
          ) : (
            <Link
              to={destinations[link]}
              key={link}
              className={cn(
                "hover:underline whitespace-nowrap",
                transparent
                  ? "text-white/90 hover:text-white"
                  : "text-zinc-900",
              )}
            >
              {link}
            </Link>
          ),
        )}
      </div>
    </div>
  );
};

export default PrelaunchNavbar;
