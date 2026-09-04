import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { href, Link, useLocation } from "react-router";
import { useAuth } from "../lib/AuthContext";
import {
  HOME_HREF,
  LOGIN_HREF,
  NAV_LINKS,
  NAV_PARTNER,
  PARTNER_HREF,
  TASKS_HREF,
} from "./links";
import { Logotype, SITE_COL, SiteArrow } from "./ui";

/** Height the pages reserve for the bar, which floats over their first band. */
export const NAV_HEIGHT = 78;

/** Past this many pixels the bar takes on a solid background. */
const SOLID_AFTER = 24;

export function Navbar({
  /**
   * Set where the bar floats over the primary band, as every page behind the
   * nav does: the type inverts and the account button goes white, since a
   * primary button on a primary band would disappear.
   */
  overPrimary = false,
}: {
  overPrimary?: boolean;
} = {}) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SOLID_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  const profileHref = user
    ? href("/member/:id", { id: user.id.toString() })
    : href("/profile");
  const accountHref = isAuthenticated ? TASKS_HREF : LOGIN_HREF;
  const accountLabel = isAuthenticated ? "My tasks" : "Log In";
  // Light type only survives while the bar is still over the primary band.
  const light = overPrimary && !scrolled && !menuOpen;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[90] w-full",
        "transition-[background-color,padding,box-shadow] duration-300",
        scrolled || menuOpen
          ? "bg-[var(--site-surface)] py-3 shadow-[0_1px_0_rgba(0,0,0,0.07)]"
          : "bg-transparent py-5 lg:py-7",
        light ? "text-white" : "text-[var(--site-ink)]",
      )}
    >
      <div
        className={cn(
          SITE_COL,
          "flex items-center justify-between gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr]",
        )}
      >
        <nav
          className="hidden items-center gap-8 text-base md:flex"
          aria-label="Primary"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={location.pathname === link.to ? "page" : undefined}
              className="inline-flex min-h-11 items-center hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          to={HOME_HREF}
          className="inline-flex min-h-11 items-center text-xl sm:text-2xl"
        >
          <Logotype onDark={light} />
        </Link>

        <div className="flex items-center justify-end gap-2.5">
          <Link
            to={PARTNER_HREF}
            className={cn(
              "hidden min-h-11 items-center px-4 text-sm font-medium transition-colors md:inline-flex bg-zinc-200 text-black hover:bg-zinc-300",
            )}
            style={{ borderRadius: "var(--site-radius-button)" }}
          >
            {NAV_PARTNER}
          </Link>
          <Link
            to={accountHref}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 px-4 text-sm font-medium transition-colors",
              light
                ? "bg-white text-[var(--site-primary)] hover:bg-white/85"
                : "bg-[var(--site-primary)] text-white hover:bg-[var(--site-primary-hover)]",
            )}
            style={{ borderRadius: "var(--site-radius-button)" }}
          >
            {accountLabel}
            <SiteArrow className="size-2.5" />
          </Link>
          {isAuthenticated && user && (
            <Link
              to={profileHref}
              aria-label="Go to profile"
              className="inline-flex shrink-0 focus:outline-none"
              style={{ borderRadius: "var(--site-radius-button)" }}
            >
              <AvatarProfile
                pfp={user.profilePicture ?? null}
                size="override"
                alt={`${user.name} profile photo`}
                className={cn(
                  "size-11 rounded-md",
                  !user.profilePicture &&
                    (light
                      ? "ring-1 ring-white/60"
                      : "ring-1 ring-[var(--site-ink)]/20"),
                )}
              />
            </Link>
          )}
          <button
            type="button"
            className="-mr-2 inline-flex size-11 items-center justify-center md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X className="size-6" aria-hidden />
            ) : (
              <Menu className="size-6" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          className="fixed inset-x-0 top-[62px] bottom-0 z-[89] flex flex-col gap-2 overflow-y-auto bg-[var(--site-surface)] px-5 pt-6 pb-12 md:hidden"
          aria-label="Primary"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={location.pathname === link.to ? "page" : undefined}
              className="border-b border-[var(--site-ink)]/10 py-4 text-2xl text-[var(--site-ink)]"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to={PARTNER_HREF}
            className="inline-flex items-center gap-2 py-4 text-2xl text-[var(--site-ink)]"
            onClick={() => setMenuOpen(false)}
          >
            {NAV_PARTNER}
            <SiteArrow className="size-3" />
          </Link>
        </nav>
      )}
    </header>
  );
}
