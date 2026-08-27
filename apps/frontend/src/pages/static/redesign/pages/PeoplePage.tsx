import { cn } from "@alliance/shared/styles/util";
import officePhoto from "../../../../assets/redesign/office.jpg";
import { currentMemberCount } from "../content";
import { RedesignPage } from "../links";
import {
  EXPERTS_BODY,
  EXPERTS_NOTE,
  EXPERTS_TITLE,
  experts,
  MEMBERS_INVITE_ONLY,
  MEMBERS_NOTE,
  MEMBERS_TITLE,
  OFFICE_BODY,
  OFFICE_PHOTO_CAPTION,
  OFFICE_TITLE,
  officeMembers,
  PEOPLE_LEDE,
  PEOPLE_TITLE,
} from "../pageContent";
import {
  BandHeading,
  BandLede,
  BandTone,
  PageBand,
  PageShell,
} from "../sections/PageShell";
import type { RedesignTheme } from "../theme";

/** Avatar slot, standing in until the real headshots are loaded. */
function AvatarSlot({
  name,
  size = "size-[62px]",
  onDark = false,
}: {
  name: string;
  size?: string;
  onDark?: boolean;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[9px] text-[0.95rem] font-medium",
        size,
        onDark
          ? "bg-white/15 text-white/70"
          : "bg-[var(--rd-ink)]/[0.08] text-[var(--rd-ink)]/45",
      )}
    >
      {initials}
    </span>
  );
}

/** Laid out like the office grid on the current site: avatar left, name right. */
function ExpertGroup() {
  return (
    <PageBand className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <BandHeading>{EXPERTS_TITLE}</BandHeading>
        <BandLede>{EXPERTS_BODY}</BandLede>
        <p className="max-w-[46rem] text-[0.95rem] text-[var(--rd-ink)]/45">
          {EXPERTS_NOTE}
        </p>
      </div>
      <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {experts.map((expert) => (
          <div key={expert.name} className="flex items-center gap-4">
            <AvatarSlot name={expert.name} />
            <div className="min-w-0">
              <p className="text-[1.08rem] leading-snug font-medium text-[var(--rd-ink)]">
                {expert.name}
              </p>
              <p className="text-[0.92rem] leading-snug text-[var(--rd-ink)]/55">
                {expert.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </PageBand>
  );
}

function Office() {
  return (
    <PageBand tone={BandTone.Primary} className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <BandHeading onDark>{OFFICE_TITLE}</BandHeading>
        <BandLede onDark className="text-white/80">
          {OFFICE_BODY}
        </BandLede>
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
        <figure className="flex flex-col gap-3">
          <img
            src={officePhoto}
            alt={OFFICE_PHOTO_CAPTION}
            className="aspect-[4/3] w-full object-cover"
            style={{ borderRadius: "var(--rd-radius-card)" }}
          />
          <figcaption className="text-sm text-white/50">
            {OFFICE_PHOTO_CAPTION}
          </figcaption>
        </figure>
        <ul className="flex flex-col">
          {officeMembers.map((member) => (
            <li
              key={member.name}
              className="flex items-center justify-between gap-6 border-t border-white/20 py-3 last:border-b"
            >
              <span className="flex items-center gap-3">
                <AvatarSlot name={member.name} size="size-10" onDark />
                <span className="text-[0.98rem] text-white">{member.name}</span>
              </span>
              <span className="text-[0.88rem] text-white/55">
                {member.role}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </PageBand>
  );
}

/** The member whose tile carries the accent, so the grid reads as one each. */
const HIGHLIGHTED_MEMBER = 97;

function MemberDirectory() {
  return (
    <PageBand className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <BandHeading>{MEMBERS_TITLE}</BandHeading>
        <BandLede>
          {`The Alliance has ${currentMemberCount} members. ${MEMBERS_INVITE_ONLY}`}
        </BandLede>
        <p className="max-w-[46rem] text-[0.95rem] text-[var(--rd-ink)]/45">
          {MEMBERS_NOTE}
        </p>
      </div>
      {/* One tile per member, waiting on the real profile pictures. */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
        }}
        aria-hidden
      >
        {Array.from({ length: currentMemberCount }, (_, i) => (
          <span
            key={i}
            className={cn(
              "aspect-square rounded-[7px]",
              i === HIGHLIGHTED_MEMBER
                ? "bg-[var(--rd-primary)]"
                : "bg-[var(--rd-ink)]/[0.09]",
            )}
          />
        ))}
      </div>
    </PageBand>
  );
}

export function RedesignPeoplePage({ theme }: { theme: RedesignTheme }) {
  return (
    <PageShell
      theme={theme}
      page={RedesignPage.People}
      title={PEOPLE_TITLE}
      lede={PEOPLE_LEDE}
    >
      <ExpertGroup />
      <Office />
      <MemberDirectory />
    </PageShell>
  );
}
