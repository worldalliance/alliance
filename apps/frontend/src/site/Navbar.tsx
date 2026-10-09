import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { Menu, RotateCw, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { href, Link, useLocation } from "react-router";
import { useAuth } from "../lib/AuthContext";
import { InviteState, useInviteSession } from "./invite/InviteSession";
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
  signupHref,
  announcement,
  offerInvite = true,
}: {
  overPrimary?: boolean;
  announcement?: ReactNode;
  /** Off where the page is itself the signup an invitation leads to. */
  offerInvite?: boolean;
  /**
   * Adds a signup call to action beside the account button while logged out,
   * and in its place once the bar is too narrow for both. Carries the referral
   * code when one brought the visitor here, so set it only where that link
   * should outrank logging in. Without it, the tab's invitation offers one.
   */
  signupHref?: string;
} = {}) {
  const { isAuthenticated, user, loading } = useAuth();
  const invite = useInviteSession();
  const showsInvite = offerInvite && signupHref === undefined;
  const inviteSignupHref = showsInvite ? invite.signupHref : null;
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
  const ctaHref = signupHref ?? inviteSignupHref;
  const showSignup = ctaHref !== null && !isAuthenticated;
  const showInviteNotice =
    showsInvite &&
    !isAuthenticated &&
    (invite.state === InviteState.Unavailable || invite.forgetFailed);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[90] w-full",
        "transition-[background-color,padding,box-shadow] duration-300",
        scrolled || menuOpen
          ? "bg-[var(--site-surface)] shadow-[0_1px_0_rgba(0,0,0,0.07)]"
          : "bg-transparent",
        light ? "text-white" : "text-[var(--site-ink)]",
      )}
    >
      {announcement}
      <div
        className={cn(
          SITE_COL,
          "flex items-center justify-between gap-6 max-[350px]:gap-3 transition-[padding] duration-300 lg:grid lg:grid-cols-[1fr_auto_1fr]",
          scrolled ? "py-3" : "py-5 lg:py-7",
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
              className="inline-flex min-h-11 items-center hover:underline font-medium"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          to={HOME_HREF}
          className="inline-flex min-h-11 items-center text-xl"
        >
          <Logotype onDark={light} />
        </Link>

        <div className="flex items-center justify-end gap-3 md:gap-6">
          {/* The cluster sheds parts as the bar narrows so the menu button always
              clears the right edge: profile picture, then the account button's
              arrow, then the account button, which goes early whenever a Sign up
              button is holding a place beside it and earlier still for an
              invitation, whose label then shortens. Tailwind's scanner reads these
              arbitrary variants literally, so each is written out rather than
              built from a template. */}
          <div
            className={cn(
              "flex items-center gap-3 md:gap-6 transition-opacity duration-300",
              loading && "pointer-events-none opacity-0",
            )}
            aria-hidden={loading}
          >
            <Link
              to={PARTNER_HREF}
              className={cn(
                "hidden md:inline-flex min-h-11 items-center hover:underline font-medium text-base",
                light ? "text-white" : "text-black",
              )}
            >
              {NAV_PARTNER}
            </Link>
            <Link
              to={accountHref}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 px-4 text-base font-medium transition-colors",
                inviteSignupHref
                  ? "max-[560px]:hidden"
                  : showSignup
                    ? "max-[420px]:hidden"
                    : "max-[310px]:hidden",
                light
                  ? "bg-white text-[var(--site-primary)] hover:bg-white/85"
                  : "bg-[var(--site-primary)] text-white hover:bg-[var(--site-primary-hover)]",
              )}
              style={{ borderRadius: "var(--site-radius-button)" }}
            >
              {accountLabel}
              <SiteArrow
                className={cn(
                  "size-2.5",
                  showSignup ? "max-[470px]:hidden" : "max-[344px]:hidden",
                )}
              />
            </Link>
            {showSignup && (
              <span className="inline-flex items-center gap-1">
                <Link
                  to={ctaHref}
                  aria-label={inviteSignupHref ? "Accept invite" : undefined}
                  className="bg-green inline-flex min-h-11 items-center px-4 max-[350px]:px-3 text-base font-medium whitespace-nowrap text-white transition-colors hover:bg-[#4d8c1d]"
                  style={{ borderRadius: "var(--site-radius-button)" }}
                >
                  {inviteSignupHref ? (
                    <>
                      Accept
                      <span className="max-[400px]:hidden">&nbsp;invite</span>
                    </>
                  ) : (
                    "Sign up"
                  )}
                </Link>
                {inviteSignupHref && <ForgetInviteButton light={light} />}
              </span>
            )}
            {isAuthenticated && user && (
              <Link
                to={profileHref}
                aria-label="Go to profile"
                className={cn(
                  "inline-flex shrink-0 focus:outline-none",
                  "max-[378px]:hidden",
                )}
                style={{ borderRadius: "var(--site-radius-button)" }}
              >
                <AvatarProfile
                  pfp={user.profilePicture ?? null}
                  size="override"
                  thumbnail
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
          </div>
          <button
            type="button"
            /* -ml-2.5 cancels the icon's inset inside its 44px tap target, so
               the flex gap beside it reads as the gap you see. */
            className={cn(
              "-mr-2 -ml-2.5 inline-flex size-11 shrink-0 items-center justify-center md:hidden",
              light ? "text-white" : "text-black",
            )}
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

      {showInviteNotice && <InviteNotice light={light} />}

      {menuOpen && (
        <nav
          className="absolute inset-x-0 top-full z-[89] flex h-[calc(100dvh-100%)] flex-col gap-2 overflow-y-auto bg-[var(--site-surface)] px-5 pt-6 pb-12 md:hidden"
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

function ForgetInviteButton({ light }: { light: boolean }) {
  const { forget } = useInviteSession();
  return (
    <button
      type="button"
      aria-label="Forget invitation"
      title="Forget invitation"
      onClick={forget}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center px-1 max-[350px]:px-0 text-sm font-medium underline underline-offset-2 opacity-70 hover:opacity-100",
        light ? "text-white" : "text-black",
      )}
    >
      Forget
    </button>
  );
}

function InviteNotice({ light }: { light: boolean }) {
  const { state, forget, dismiss, forgetFailed } = useInviteSession();
  return (
    <p
      role="status"
      className={cn(
        SITE_COL,
        "flex items-center gap-1 pb-3 text-sm",
        light ? "text-white/85" : "text-[var(--site-ink)]/70",
      )}
    >
      {forgetFailed ? (
        <>
          We couldn’t clear this invitation, so reloading may bring it back.
          <button
            type="button"
            aria-label="Try again"
            title="Try again"
            onClick={forget}
            className="-my-1.5 inline-flex size-11 shrink-0 items-center justify-center"
          >
            <RotateCw className="size-4" aria-hidden />
          </button>
        </>
      ) : (
        state === InviteState.Unavailable && (
          <>
            This invitation is no longer available.
            <button
              type="button"
              aria-label="Dismiss"
              title="Dismiss"
              onClick={dismiss}
              className="-my-1.5 inline-flex size-11 shrink-0 items-center justify-center"
            >
              <X className="size-4" aria-hidden />
            </button>
          </>
        )
      )}
    </p>
  );
}
