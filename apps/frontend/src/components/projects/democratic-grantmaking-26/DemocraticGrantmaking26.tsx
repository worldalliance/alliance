import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { cn } from "@alliance/shared/styles/util";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { DocProse, DocProseSize } from "../../../site/DocProse";
import { SiteFooter } from "../../../site/Footer";
import { WAITLIST_HREF } from "../../../site/links";
import { NAV_HEIGHT, Navbar } from "../../../site/Navbar";
import {
  BandHeading,
  BandHeadingSize,
  SiteRoot,
} from "../../../site/PageShell";
import { SITE_COL } from "../../../site/ui";
import { ExpertGrid } from "./ExpertGrid";
import { MemberWaitlistBar } from "./MemberWaitlistBar";
import {
  ABOUT_SECTIONS,
  WAITLIST_HERO_IMAGES,
  type WaitlistHeroImage,
} from "./placeholders";
import { ProjectTimeline } from "./ProjectTimeline";
import { useWaitlistCount } from "./useWaitlist";
import { WaitlistSignupForm } from "./WaitlistSignupForm";

export function meta() {
  return socialPreviewMeta({
    title: "Alliance Democratic Grantmaking",
    description: `We're planning a project in which members and experts will work together to make a significant grant.`,
    url: WAITLIST_HREF,
    image: "/grantmaking-link-thumbnail.png",
  });
}

const PROJECT_COL = cn(SITE_COL, "lg:max-w-[1400px]");

export function WaitlistHeroImages({
  images,
}: {
  images: readonly WaitlistHeroImage[];
}) {
  const described = images.some((image) => image.src);
  return (
    <ul
      aria-hidden={described ? undefined : true}
      aria-label={described ? "Project images" : undefined}
      className="flex aspect-square w-[min(100%,calc(100svh-10rem))] shrink-0 flex-col gap-2 lg:w-[min(38rem,42vw,calc(100svh-10rem))]"
    >
      {images.map((image, index) => (
        <li key={index} className="min-h-0 flex-1 overflow-hidden bg-zinc-200">
          {image.src && (
            <img
              src={image.src}
              alt={image.alt}
              className="size-full object-cover"
              style={{ objectPosition: image.position }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function WaitlistScreen() {
  return (
    <section
      aria-label="Waitlist"
      className="flex min-h-svh flex-col bg-white"
      style={{ paddingTop: NAV_HEIGHT }}
    >
      <div
        className={cn(
          PROJECT_COL,
          "my-auto grid grid-cols-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-24 lg:py-12 xl:gap-x-32",
        )}
      >
        <div className="flex flex-col gap-4 lg:gap-5">
          <p className="-mb-2 text-left text-[1.05rem] text-[var(--site-ink)]/70 sm:text-[1.2rem]">
            Fall 2026
          </p>
          <h1 className="site-display font-medium text-5xl sm:text-6xl lg:text-7xl">
            Vote on where we donate{" "}
            <span className="site-display font-semibold text-green">
              $100,000
            </span>
          </h1>
          <p className="text-left text-xl sm:text-2xl">
            Join the Alliance to participate in this grantmaking project.
          </p>
          <WaitlistSignupForm className="mt-2 w-full" />
        </div>
        <div className="flex justify-center lg:justify-end">
          <WaitlistHeroImages images={WAITLIST_HERO_IMAGES} />
        </div>
      </div>
    </section>
  );
}

function ProjectProgress() {
  const members = useAllianceMemberCount();
  const waitlist = useWaitlistCount();
  if (members.data !== undefined && waitlist.data !== undefined) {
    return (
      <MemberWaitlistBar members={members.data} waitlist={waitlist.data} />
    );
  }
  return (
    <p className="site-sans text-base text-[var(--site-ink)]/70">
      {members.isError || waitlist.isError
        ? "Member and waitlist counts unavailable"
        : "Loading member and waitlist counts…"}
    </p>
  );
}

export default function DemocraticGrantmaking26() {
  return (
    <SiteRoot className="bg-white">
      <Navbar />
      <main>
        <WaitlistScreen />
        <div className="bg-white pb-10 lg:flex lg:flex-col lg:pb-0">
          <div
            className={cn(
              PROJECT_COL,
              "flex flex-col gap-12 sm:gap-24 lg:gap-32",
            )}
          >
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-1">
                <p className="text-center text-xl sm:text-2xl font-medium">
                  You make this project possible.
                </p>
                <p className="text-center text-xl sm:text-2xl">
                  Once 1,000 members join the Alliance, external funders will
                  donate $100,000 to this project.
                </p>
              </div>
              <ProjectProgress />
            </div>
            <div className="flex flex-col gap-12">
              <div className="flex flex-col gap-1">
                <p className="text-center text-xl sm:text-2xl font-medium">
                  We&apos;re improving expert-public communication.
                </p>
                <p className="text-center text-xl sm:text-2xl">
                  Members and experts will work together to select a nonprofit
                  to receive the grant.
                </p>
              </div>
              <ProjectTimeline currentIdx={0} />
            </div>
          </div>
          <div className={cn(PROJECT_COL, "mt-12 lg:mt-28 lg:pb-24")}>
            <div className="flex flex-col items-center gap-8 rounded-lg bg-zinc-100 px-7 py-8 sm:px-14 sm:py-10">
              <div className="flex flex-col items-center gap-1">
                <p className="text-center text-xl sm:text-2xl font-medium">
                  Expert panel
                </p>
                <p className="text-center text-lg text-[var(--site-ink)]/70 sm:text-xl">
                  20+ experts will comment on candidate nonprofits to help you
                  make an informed vote.
                </p>
              </div>
              <div className="w-full">
                <ExpertGrid />
              </div>
            </div>
          </div>
        </div>
        <div
          className={cn(
            PROJECT_COL,
            "pt-6 pb-20 md:pt-[1.05rem] md:pb-24 lg:pt-12 lg:pb-32",
          )}
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-12 md:gap-16">
            {ABOUT_SECTIONS.map(({ heading, body }) => (
              <section
                key={heading}
                className="flex flex-col items-start gap-5 text-left"
              >
                <BandHeading
                  size={BandHeadingSize.Section}
                  className="text-left"
                >
                  {heading}
                </BandHeading>
                <DocProse
                  size={DocProseSize.Large}
                  markdown={body}
                  className="w-full text-left"
                />
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </SiteRoot>
  );
}
