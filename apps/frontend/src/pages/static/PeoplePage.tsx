import {
  userNmembers,
  type StaffDirectoryEntryDto,
} from "@alliance/shared/client";
import { shuffleWithSeed } from "@alliance/shared/forms/randomutils";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { href, Link, useLoaderData } from "react-router";
import officePhoto from "../../assets/redesign/office.jpg";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import {
  BandHeading,
  BandTone,
  PageBand,
  PageShell,
} from "../../site/PageShell";
import { usePublicMembers, useStaffDirectory } from "../../site/data";
import { experts } from "../../site/peopleContent";
import { SectionSubtitle } from "../../site/ui";

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

const OFFICE_PHOTO_CAPTION = "The office in San Francisco, California";

const MEMBER_ROWS = 2;
const MEMBER_GAP_PX = 8;
const PROFILE_TILE_PX = 80;

function memberGridCols(width: number, memberCount: number): number {
  if (width <= 0 || memberCount <= 0) return 0;
  const maxCols = Math.max(
    1,
    Math.floor((width + MEMBER_GAP_PX) / (PROFILE_TILE_PX + MEMBER_GAP_PX)),
  );
  if (memberCount >= maxCols * MEMBER_ROWS) return maxCols;
  return Math.ceil(memberCount / MEMBER_ROWS);
}

/** Four columns of names, since we hold no photographs of the expert group. */
function ExpertGroup() {
  return (
    <PageBand
      id="expert-group"
      tone={BandTone.Primary}
      className="flex flex-col gap-10"
    >
      <div className="flex flex-col gap-3">
        <BandHeading onDark>Expert group</BandHeading>
        <SectionSubtitle onDark>
          Experts occasionally lend time, knowledge, or resources to the
          Alliance.
        </SectionSubtitle>
      </div>
      <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {experts.map((expert) => (
          <div key={expert.name} className="min-w-0">
            <p className="text-lg leading-snug font-medium text-white">
              {expert.name}
            </p>
            <p className="text-base leading-snug text-white/55">
              {expert.description}
            </p>
          </div>
        ))}
      </div>
    </PageBand>
  );
}

function StaffPerson({ member }: { member: StaffDirectoryEntryDto }) {
  const inner = (
    <>
      <div
        className="shrink-0 overflow-hidden rounded-[7px] bg-[var(--site-ink)]/[0.09]"
        style={{ width: PROFILE_TILE_PX, height: PROFILE_TILE_PX }}
      >
        <AvatarProfile
          pfp={member.profilePicture}
          size="override"
          alt=""
          className="size-full rounded-[7px]"
        />
      </div>
      <div className="min-w-0">
        <p className="text-lg leading-snug font-medium text-[var(--site-ink)] group-hover:underline decoration-[var(--site-ink)]/40 underline-offset-2 group-hover:decoration-[var(--site-ink)]">
          {member.displayName}
        </p>
        {member.staffTitle && (
          <p className="text-base leading-snug text-[var(--site-ink)]/55">
            {member.staffTitle}
          </p>
        )}
      </div>
    </>
  );

  if (!member.staffLink) {
    return <div className="flex items-center gap-3">{inner}</div>;
  }

  return (
    <a
      href={member.staffLink}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-3"
    >
      {inner}
    </a>
  );
}

function Office() {
  const { data: staff, isPending } = useStaffDirectory();

  return (
    <PageBand id="office" className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <BandHeading>Office</BandHeading>
        <SectionSubtitle>
          Our staff team plans actions, creates infrastructure, and manages the
          Alliance.
        </SectionSubtitle>
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
        <figure className="flex flex-col gap-3">
          <img
            src={officePhoto}
            alt={OFFICE_PHOTO_CAPTION}
            className="aspect-[4/3] w-full object-cover"
            style={{ borderRadius: "var(--site-radius-card)" }}
          />
          <figcaption className="text-sm text-[var(--site-ink)]/50">
            {OFFICE_PHOTO_CAPTION}
          </figcaption>
        </figure>
        {isPending ? (
          <p className="text-[var(--site-ink)]/50">Loading staff…</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-8 gap-y-8">
            {(staff ?? []).map((member) => (
              <li key={member.id} className="min-w-0">
                <StaffPerson member={member} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageBand>
  );
}

function MemberDirectory({ memberCount }: { memberCount: number | undefined }) {
  const { data: members, isPending } = usePublicMembers();
  const gridRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const shuffleSeed = useRef(Math.random().toString());

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const update = () => setWidth(grid.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [isPending]);

  const shuffled = useMemo(
    () => shuffleWithSeed(members ?? [], shuffleSeed.current),
    [members],
  );
  const cols = memberGridCols(width, shuffled.length);
  const visible = shuffled.slice(0, cols * MEMBER_ROWS);

  return (
    <PageBand id="members" className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <BandHeading>Members</BandHeading>
        {memberCount !== undefined && (
          <SectionSubtitle>
            {`The Alliance has ${memberCount} ${memberCount === 1 ? "member" : "members"}. Membership is currently by invitation only.`}
          </SectionSubtitle>
        )}
      </div>
      {isPending ? (
        <p className="text-[var(--site-ink)]/50">Loading members…</p>
      ) : (
        <div
          ref={gridRef}
          className="grid"
          style={{
            gap: MEMBER_GAP_PX,
            gridTemplateColumns:
              cols > 0 ? `repeat(${cols}, minmax(0, 1fr))` : undefined,
            gridTemplateRows: `repeat(${MEMBER_ROWS}, auto)`,
          }}
        >
          {visible.map((member) => (
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
    <PageShell title={PEOPLE_TITLE}>
      <Office />
      <ExpertGroup />
      <MemberDirectory memberCount={memberCount} />
    </PageShell>
  );
}
