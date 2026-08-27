import { cn } from "@alliance/shared/styles/util";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NAV_LINKS, NAV_LOGIN, NAV_PARTNER } from "../content";
import { LOGIN_HREF, rdHref, RedesignPage } from "../links";
import { NavStart, type RedesignTheme } from "../theme";
import { Logotype, RD_COL, RdArrow } from "../ui";

/** Height the heroes reserve when the bar isn't overlaying artwork. */
export const NAV_HEIGHT = 78;

/** Past this many pixels the bar takes on a solid background. */
const SOLID_AFTER = 24;

export function Nav({
  theme,
  start,
  current = RedesignPage.Home,
}: {
  theme: RedesignTheme;
  start: NavStart;
  /** Underlines the page you are on, so the bar says where you are. */
  current?: RedesignPage;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SOLID_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  // Light type only survives while the bar is still over the artwork.
  const light = start !== NavStart.Surface && !scrolled && !menuOpen;
  // A primary button on the primary band would vanish, so it inverts there.
  const invertedLogin = light && start === NavStart.Primary;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[90] w-full transition-[background-color,padding,box-shadow] duration-300",
        scrolled || menuOpen
          ? "bg-[var(--rd-surface)] py-3 shadow-[0_1px_0_rgba(0,0,0,0.07)]"
          : "bg-transparent py-5 lg:py-7",
        light ? "text-white" : "text-[var(--rd-ink)]",
      )}
    >
      <div
        className={cn(
          RD_COL,
          "flex items-center justify-between gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr]",
        )}
      >
        <nav
          className="hidden items-center gap-8 text-base md:flex"
          aria-label="Primary"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.page}
              href={rdHref(theme.version, link.page)}
              aria-current={link.page === current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center hover:underline",
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href={rdHref(theme.version, RedesignPage.Home)}
          className="inline-flex min-h-11 items-center text-xl sm:text-2xl"
        >
          <Logotype theme={theme} onDark={light} />
        </a>

        <div className="flex items-center justify-end gap-2.5">
          <a
            href={rdHref(theme.version, RedesignPage.Partner)}
            className={cn(
              "hidden min-h-11 items-center px-4 text-sm font-medium transition-colors sm:inline-flex",
              light
                ? "border border-white/55 text-white hover:bg-white/10"
                : "border border-[var(--rd-ink)]/25 hover:border-[var(--rd-ink)]/55",
            )}
            style={{ borderRadius: "var(--rd-radius-button)" }}
          >
            {NAV_PARTNER}
          </a>
          <a
            href={LOGIN_HREF}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 px-4 text-sm font-medium transition-colors",
              invertedLogin
                ? "bg-white text-[var(--rd-primary)] hover:bg-white/85"
                : "bg-[var(--rd-primary)] text-white hover:bg-[var(--rd-primary-hover)]",
            )}
            style={{ borderRadius: "var(--rd-radius-button)" }}
          >
            {NAV_LOGIN}
            <RdArrow className="size-2.5" />
          </a>
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
          className="fixed inset-x-0 top-[62px] bottom-0 z-[89] flex flex-col gap-2 bg-[var(--rd-surface)] px-5 pt-6 pb-12 md:hidden"
          aria-label="Primary"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.page}
              href={rdHref(theme.version, link.page)}
              aria-current={link.page === current ? "page" : undefined}
              className="border-b border-[var(--rd-ink)]/10 py-4 text-2xl text-[var(--rd-ink)]"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href={rdHref(theme.version, RedesignPage.Partner)}
            className="inline-flex items-center gap-2 py-4 text-2xl text-[var(--rd-ink)]"
            onClick={() => setMenuOpen(false)}
          >
            {NAV_PARTNER}
            <RdArrow className="size-3" />
          </a>
        </nav>
      )}
    </header>
  );
}
