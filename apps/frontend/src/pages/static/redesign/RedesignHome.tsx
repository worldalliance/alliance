import { Hero } from "./sections/Hero";
import { Nav } from "./sections/Nav";
import { HowItWorks } from "./sections/HowItWorks";
import { JoinCta } from "./sections/JoinCta";
import { ModelSection } from "./sections/ModelSection";
import { HeadlineIntro, Priorities } from "./sections/Priorities";
import { SiteFooter } from "./sections/SiteFooter";
import { Testimonial } from "./sections/Testimonial";
import { navStartsOnDark, themeVars, type RedesignTheme } from "./theme";

/**
 * Versions 1 to 3 carry the headline in the hero. Version 4's hero is the
 * notification animation alone, so its headline sits in a block below it.
 */
export function RedesignHome({ theme }: { theme: RedesignTheme }) {
  return (
    <div
      className="rd-root min-h-screen bg-[var(--rd-surface)] text-[var(--rd-ink)]"
      style={themeVars(theme)}
    >
      <Nav theme={theme} onDark={navStartsOnDark[theme.hero]} />
      <Hero theme={theme} />
      {theme.showHeadlineIntro && <HeadlineIntro theme={theme} />}
      <Priorities />
      <HowItWorks />
      <ModelSection theme={theme} />
      <Testimonial theme={theme} />
      <JoinCta theme={theme} />
      <SiteFooter theme={theme} />
    </div>
  );
}
