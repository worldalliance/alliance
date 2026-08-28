import AllianceIntroYouTubeEmbed from "../../components/AllianceIntroYouTubeEmbed";
import { SITE_COL } from "../ui";

export function IntroVideo() {
  return (
    <section
      aria-label="Alliance introduction video"
      className="bg-[var(--site-surface)] pb-16 lg:pb-24"
    >
      <div className={SITE_COL}>
        <div
          className="overflow-hidden"
          style={{ borderRadius: "var(--site-radius-card)" }}
        >
          <AllianceIntroYouTubeEmbed />
        </div>
      </div>
    </section>
  );
}
