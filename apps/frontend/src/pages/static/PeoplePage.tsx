import { userNmembers } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { href, Link, useLoaderData } from "react-router";
import officePhoto from "../../assets/redesign/office.jpg";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import {
  BandHeading,
  BandLede,
  BandTone,
  PageBand,
  PageShell,
} from "../../site/PageShell";
import { usePublicMembers, useStaffDirectory } from "../../site/data";
import { experts } from "../../site/peopleContent";

export function meta() {
  return socialPreviewMeta({
    title: "People — The Alliance",
    description:
      "A full-time office plans the actions. Members carry them out. Experts tell us where we are wrong.",
    url: "/people",
  });
}

export async function loader() {
  const res = await userNmembers();
  return res.data?.count;
}

const PEOPLE_TITLE = "People";
const PEOPLE_LEDE =
  "A full-time office plans the actions. Members carry them out. Experts tell us where we are wrong.";

const OFFICE_PHOTO_CAPTION = "The office in San Francisco";

/** Four columns of names, since we hold no photographs of the expert group. */
function ExpertGroup() {
  return (
    <PageBand id="expert-group" className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <BandHeading>Expert group</BandHeading>
        <BandLede>
          Experts occasionally lend time, knowledge, or resources to the
          Alliance.
        </BandLede>
        <p className="max-w-[46rem] text-[0.95rem] text-[var(--site-ink)]/45">
          This list only includes experts who have chosen to make their
          information public.
        </p>
      </div>
      <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {experts.map((expert) => (
          <div key={expert.name} className="min-w-0">
            <p className="text-[1.08rem] leading-snug font-medium text-[var(--site-ink)]">
              {expert.name}
            </p>
            <p className="text-[0.92rem] leading-snug text-[var(--site-ink)]/55">
              {expert.description}
            </p>
          </div>
        ))}
      </div>
    </PageBand>
  );
}

function Office() {
  const { data: staff, isPending } = useStaffDirectory();

  return (
    <PageBand
      id="office"
      tone={BandTone.Primary}
      className="flex flex-col gap-10"
    >
      <div className="flex flex-col gap-3">
        <BandHeading onDark>Office</BandHeading>
        <BandLede onDark className="text-white/80">
          Our staff team plans actions, creates infrastructure, and manages the
          Alliance.
        </BandLede>
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
        <figure className="flex flex-col gap-3">
          <img
            src={officePhoto}
            alt={OFFICE_PHOTO_CAPTION}
            className="aspect-[4/3] w-full object-cover"
            style={{ borderRadius: "var(--site-radius-card)" }}
          />
          <figcaption className="text-sm text-white/50">
            {OFFICE_PHOTO_CAPTION}
          </figcaption>
        </figure>
        {isPending ? (
          <p className="text-white/60">Loading staff…</p>
        ) : (
          <ul className="flex flex-col">
            {(staff ?? []).map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-6 border-t border-white/20 py-3 last:border-b"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <AvatarProfile
                    pfp={member.profilePicture ?? null}
                    size="override"
                    alt=""
                    className="size-10 rounded-[9px]"
                  />
                  <span className="truncate text-[0.98rem] text-white">
                    {member.displayName}
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  {member.staffTitle && (
                    <span className="text-[0.88rem] text-white/55">
                      {member.staffTitle}
                    </span>
                  )}
                  {member.staffLink && (
                    <a
                      href={member.staffLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[0.88rem] text-white/80 underline decoration-white/40 underline-offset-2 hover:decoration-white"
                    >
                      About
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageBand>
  );
}

/**
 * One tile per public member, each their own profile picture and a link to
 * their profile. Dense enough that the roll reads as a body of people rather
 * than a list of cards.
 */
function MemberDirectory({ memberCount }: { memberCount: number | undefined }) {
  const { data: members, isPending } = usePublicMembers();

  return (
    <PageBand id="members" className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <BandHeading>Members</BandHeading>
        {memberCount !== undefined && (
          <BandLede>
            {`The Alliance has ${memberCount} ${memberCount === 1 ? "member" : "members"}. Membership is currently by invitation only.`}
          </BandLede>
        )}
        <p className="max-w-[46rem] text-[0.95rem] text-[var(--site-ink)]/45">
          This directory only includes members who have chosen to make their
          information public.
        </p>
      </div>
      {isPending ? (
        <p className="text-[var(--site-ink)]/50">Loading members…</p>
      ) : (
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
          }}
        >
          {(members ?? []).map((member) => (
            <Link
              key={member.id}
              to={href("/member/:id", { id: member.id.toString() })}
              title={member.displayName}
              aria-label={member.displayName}
              className={cn(
                "aspect-square overflow-hidden rounded-[7px] bg-[var(--site-ink)]/[0.09]",
                "transition-transform duration-200 ease-out hover:-translate-y-0.5",
              )}
            >
              <AvatarProfile
                pfp={member.profilePicture ?? null}
                size="override"
                alt=""
                className="size-full rounded-[7px]"
              />
            </Link>
          ))}
        </div>
      )}
    </PageBand>
  );
}

export default function PeoplePage() {
  const memberCount = useLoaderData<typeof loader>();

  return (
    <PageShell title={PEOPLE_TITLE} lede={PEOPLE_LEDE}>
      <ExpertGroup />
      <Office />
      <MemberDirectory memberCount={memberCount} />
    </PageShell>
  );
}
