import { Hero } from "./sections/Hero";
import { Nav } from "./sections/Nav";
import { HowItWorks } from "./sections/HowItWorks";
import { JoinCta } from "./sections/JoinCta";
import { ModelSection } from "./sections/ModelSection";
import { HeadlineIntro, Priorities } from "./sections/Priorities";
import { SiteFooter } from "./sections/SiteFooter";
import { Testimonial } from "./sections/Testimonial";
import { navStart, themeVars, type RedesignTheme } from "./theme";

/**
 * Most versions carry the headline in the hero. Versions 4 and 5 give the hero
 * over to member activity instead, so their headline sits in a block below it.
 */
export function RedesignHome({ theme }: { theme: RedesignTheme }) {
  return (
    <div
      className="rd-root min-h-screen bg-[var(--rd-surface)] text-[var(--rd-ink)]"
      style={themeVars(theme)}
    >
      <Nav theme={theme} start={navStart[theme.hero]} />
      <Hero theme={theme} />
      {theme.showHeadlineIntro && <HeadlineIntro theme={theme} />}
      <Priorities showNote={theme.showPrioritiesNote} />
      <HowItWorks theme={theme} />
      <ModelSection theme={theme} />
      <Testimonial theme={theme} />
      <JoinCta theme={theme} />
      <SiteFooter theme={theme} />
    </div>
  );
}
