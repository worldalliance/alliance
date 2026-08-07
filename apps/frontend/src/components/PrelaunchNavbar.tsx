import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { Link, href, useNavigate } from "react-router";
import { useAuth } from "../lib/AuthContext";

enum NavbarPage {
  People = "People",
  Guide = "Guide",
  Progress = "Progress",
  Partner = "Partner",
  LogIn = "Log in",
}

const links: NavbarPage[] = [
  NavbarPage.People,
  NavbarPage.Guide,
  NavbarPage.Progress,
  NavbarPage.Partner,
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
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const profileUrl = user
    ? href("/member/:id", { id: user.id.toString() })
    : href("/profile");

  const destinations: Record<NavbarPage, string> = {
    [NavbarPage.People]: href("/people"),
    [NavbarPage.Guide]: href("/guide"),
    [NavbarPage.Progress]: href("/progress"),
    [NavbarPage.Partner]: href("/outreach-partner"),
    [NavbarPage.LogIn]: isAuthenticated ? href("/tasks") : href("/login"),
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-y-3",
        "sm:flex-row sm:gap-y-0 md:gap-y-4 py-4 md:py-6 px-4 sm:px-8 md:px-16",
        "top-0 left-0 z-10 text-[14pt] transition-[padding,background-color] duration-300",
        absolute ? "absolute" : "relative",
        "w-full",
        showLogo ? "justify-between" : "justify-end",
        transparent ? "bg-transparent text-white" : "text-black bg-white",
      )}
      ref={ref}
    >
      {showLogo && (
        <h1
          className={cn(
            "font-bold font-berlingske text-lg sm:text-xl md:text-2xl cursor-pointer text-nowrap",
            transparent ? "text-white" : undefined,
          )}
          onClick={() => {
            navigate(href("/"));
          }}
        >
          THE ALLIANCE
        </h1>
      )}
      <div className="flex flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-10 text-base sm:text-lg md:text-xl">
        {links.map((link) =>
          link === NavbarPage.LogIn ? (
            <div key={link} className="flex flex-row items-center gap-x-3">
              <Link
                to={destinations[link]}
                className={cn(
                  "py-2 sm:py-2.5 px-3 sm:px-5 rounded-md whitespace-nowrap font-medium",
                  transparent
                    ? "bg-white text-black hover:bg-zinc-100"
                    : "bg-black text-white hover:bg-zinc-800",
                )}
              >
                {isAuthenticated ? "My tasks" : "Log in"}
              </Link>
              {isAuthenticated && user ? (
                <Link
                  to={profileUrl}
                  aria-label="Go to profile"
                  className="rounded-md focus:outline-none"
                >
                  <AvatarProfile
                    pfp={user.profilePicture ?? null}
                    size="override"
                    className={cn(
                      "h-10 w-10 sm:h-12 sm:w-12 rounded-md",
                      !user.profilePicture &&
                        cn(
                          "ring-2",
                          transparent ? "ring-white" : "ring-zinc-200",
                        ),
                    )}
                  />
                </Link>
              ) : (
                showSignupButton && (
                  <Link
                    to={signupHref}
                    className={cn(
                      "py-2 sm:py-2.5 px-3 sm:px-5 rounded-md whitespace-nowrap font-medium",
                      transparent
                        ? "bg-green text-white hover:bg-[#4d8c1d]"
                        : "bg-green text-white hover:bg-[#4d8c1d]",
                    )}
                  >
                    Sign up
                  </Link>
                )
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
