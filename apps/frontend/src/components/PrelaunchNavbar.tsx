import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, href, useLocation, useNavigate } from "react-router";
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
  const location = useLocation();
  const [condensed, setCondensed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (absolute) {
      setCondensed(false);
      return;
    }

    const onScroll = () => {
      setCondensed(window.scrollY > 8);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [absolute]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

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

  const authActions = (opts: {
    condensedStyle: boolean;
    stacked: boolean;
    onSolid: boolean;
  }) => (
    <div
      className={cn(
        "flex items-center gap-x-3",
        opts.stacked && "w-full flex-col items-stretch gap-y-3",
      )}
    >
      <Link
        to={destinations[NavbarPage.LogIn]}
        className={cn(
          "rounded-md whitespace-nowrap font-medium transition-[padding,font-size] duration-300",
          opts.stacked && "text-center",
          opts.condensedStyle
            ? "py-1.5 px-2.5 text-sm sm:py-2 sm:px-3.5 sm:text-base"
            : "py-2 sm:py-2.5 px-3 sm:px-5",
          opts.onSolid
            ? "bg-black text-white hover:bg-zinc-800"
            : "bg-white text-black hover:bg-zinc-100",
        )}
        onClick={() => setMenuOpen(false)}
      >
        {isAuthenticated ? "My tasks" : "Log in"}
      </Link>
      {isAuthenticated && user ? (
        <Link
          to={profileUrl}
          aria-label="Go to profile"
          className={cn(
            "rounded-md focus:outline-none",
            opts.stacked && "self-center",
          )}
          onClick={() => setMenuOpen(false)}
        >
          <AvatarProfile
            pfp={user.profilePicture ?? null}
            size="override"
            className={cn(
              "rounded-md transition-[width,height] duration-300",
              opts.condensedStyle
                ? "h-8 w-8 sm:h-9 sm:w-9"
                : "h-10 w-10 sm:h-12 sm:w-12",
              !user.profilePicture &&
                cn("ring-2", opts.onSolid ? "ring-zinc-200" : "ring-white"),
            )}
          />
        </Link>
      ) : (
        showSignupButton && (
          <Link
            to={signupHref}
            className={cn(
              "rounded-md whitespace-nowrap font-medium bg-green text-white hover:bg-[#4d8c1d] transition-[padding,font-size] duration-300",
              opts.stacked && "text-center",
              opts.condensedStyle
                ? "py-1.5 px-2.5 text-sm sm:py-2 sm:px-3.5 sm:text-base"
                : "py-2 sm:py-2.5 px-3 sm:px-5",
            )}
            onClick={() => setMenuOpen(false)}
          >
            Sign up
          </Link>
        )
      )}
    </div>
  );

  const textLinks = links.filter((link) => link !== NavbarPage.LogIn);

  return (
    <div
      className={cn(
        "flex flex-row items-center px-4 sm:px-8 md:px-16",
        condensed ? "py-2 md:py-3" : "py-4 md:py-6",
        "top-0 left-0 z-50 text-[14pt] transition-[padding,background-color] duration-300",
        absolute ? "absolute" : "sticky",
        "w-full",
        showLogo ? "justify-between" : "justify-end",
        transparent ? "bg-transparent text-white" : "bg-white text-black",
      )}
      ref={ref}
    >
      {showLogo && (
        <h1
          className={cn(
            "font-bold font-berlingske text-lg sm:text-xl md:text-2xl cursor-pointer text-nowrap",
            transparent && "text-white",
          )}
          onClick={() => {
            setMenuOpen(false);
            navigate(href("/"));
          }}
        >
          THE ALLIANCE
        </h1>
      )}

      <nav
        className="hidden md:flex flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-10 text-base sm:text-lg md:text-xl"
        aria-label="Primary"
      >
        {textLinks.map((link) => (
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
        ))}
        {authActions({
          condensedStyle: condensed,
          stacked: false,
          onSolid: !transparent,
        })}
      </nav>

      <button
        type="button"
        className={cn(
          "md:hidden -mr-1 rounded-md p-2 focus:outline-none",
          transparent
            ? "text-white hover:bg-white/10"
            : "text-zinc-900 hover:bg-zinc-100",
        )}
        aria-label="Open menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(true)}
      >
        <Menu size={24} aria-hidden />
      </button>

      {menuOpen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-white md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div
            className={cn(
              "flex flex-row items-center px-4 sm:px-8",
              condensed ? "py-2" : "py-4",
              showLogo ? "justify-between" : "justify-end",
            )}
          >
            {showLogo && (
              <h1
                className="font-bold font-berlingske text-lg sm:text-xl cursor-pointer text-nowrap text-zinc-900"
                onClick={() => {
                  setMenuOpen(false);
                  navigate(href("/"));
                }}
              >
                THE ALLIANCE
              </h1>
            )}
            <button
              type="button"
              className="-mr-1 rounded-md p-2 text-zinc-900 hover:bg-zinc-100 focus:outline-none"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <X size={24} aria-hidden />
            </button>
          </div>

          <nav
            className="flex flex-1 flex-col justify-center gap-8 px-6 pb-12 sm:px-10"
            aria-label="Primary"
          >
            {textLinks.map((link) => (
              <Link
                to={destinations[link]}
                key={link}
                className="text-3xl font-medium text-zinc-900 hover:underline sm:text-4xl"
                onClick={() => setMenuOpen(false)}
              >
                {link}
              </Link>
            ))}
            <div className="pt-4">
              {authActions({
                condensedStyle: false,
                stacked: true,
                onSolid: true,
              })}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
};

export default PrelaunchNavbar;
