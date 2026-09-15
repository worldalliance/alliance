import type {
  ContractDto,
  ProfileDto,
  ReferrerProfileDto,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { Check } from "lucide-react";
import { href } from "react-router";
import { riseStyle, StepHeadline, StepNote } from "./chrome";
import { useScrollFeather } from "./useScrollFeather";

export const AGREEMENT_HEADLINE =
  "Join a group of people who can count on each other.";

export const AGREEMENT_NOTE =
  "This agreement is core to our planning ability. Once you enter it, you become a member.";

/** Overlapping faces stop fitting the panel's width past this on a phone. */
const FACE_COUNT = 5;

/** Matches `AvatarProfile`'s square sizes, which never go round. */
const FACE =
  "size-[clamp(1.5rem,3.1vh,2.1rem)] rounded ring-2 ring-[var(--ob-navy)]";

const FIELD =
  "h-[clamp(2.1rem,4.4vh,2.75rem)] w-full shrink-0 rounded-md border bg-white px-3.5 text-black outline-none transition-colors placeholder:text-zinc-400";

const FIELD_IDLE = "border-zinc-300 focus:border-[var(--ob-navy)]";

const CARD_SURFACE = "bg-white/95";

const CARD_INLINE_PAD = "px-[clamp(1.15rem,2.8vh,2rem)]";

function SignedBy({
  inviter,
  faces,
  signedCount,
  className,
}: {
  inviter: ReferrerProfileDto | null;
  faces: ProfileDto[];
  signedCount: number;
  className?: string;
}) {
  const shown = faces.slice(0, inviter ? FACE_COUNT - 1 : FACE_COUNT);

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-start gap-2 text-left",
        className,
      )}
    >
      {(inviter || shown.length > 0) && (
        <span className="flex -space-x-2" aria-hidden>
          {inviter && (
            <AvatarProfile
              pfp={inviter.profilePicture}
              size="override"
              alt=""
              className={FACE}
            />
          )}
          {shown.map((member) => (
            <AvatarProfile
              key={member.id}
              pfp={member.profilePicture}
              size="override"
              alt=""
              className={FACE}
            />
          ))}
        </span>
      )}
      <p className="text-[length:var(--ob-ui)] leading-snug text-pretty text-white">
        {inviter ? (
          <>
            <span className="font-medium">{inviter.displayName}</span> and{" "}
            {Math.max(signedCount - 1, 0).toLocaleString("en-US")} others have
            entered the agreement.
          </>
        ) : (
          <>
            {signedCount.toLocaleString("en-US")} members have signed the
            agreement.
          </>
        )}
      </p>
    </div>
  );
}

export function AgreementStep({
  contract,
  inviter,
  faces,
  signedCount,
  signedName,
  onSignedNameChange,
  error,
  received,
}: {
  contract: ContractDto;
  inviter: ReferrerProfileDto | null;
  faces: ProfileDto[];
  signedCount: number;
  signedName: string;
  onSignedNameChange: (name: string) => void;
  error: string | null;
  /** Only after Join is pressed, which is what the bar confirms. */
  received: boolean;
}) {
  // The agreement gives up its own height before anything else does, so the
  // headline, the field, the faces and the buttons all stay on screen when the
  // keyboard takes half the viewport.
  const terms = useScrollFeather<HTMLDivElement>();

  return (
    <div className="mx-auto flex min-h-0 w-full flex-1 flex-col justify-center gap-[clamp(0.55rem,1.7vh,1.15rem)]">
      <div className="flex shrink-0 flex-col items-center gap-[clamp(0.4rem,1.2vh,0.85rem)]">
        <StepHeadline>{AGREEMENT_HEADLINE}</StepHeadline>
        <StepNote index={2}>{AGREEMENT_NOTE}</StepNote>
      </div>

      <div
        className="ob-rise mx-auto flex max-h-full min-h-0 w-full max-w-[40rem] flex-col gap-[clamp(0.55rem,1.7vh,1.15rem)]"
        style={riseStyle(3)}
      >
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg">
          {/* The minimum belongs to the band, not to the scroller inside it:
              a scroller that refuses to shrink runs out under the field. */}
          <div
            className={cn(
              "flex min-h-[3.25rem] flex-1 flex-col py-[clamp(0.6rem,2.2vh,2rem)]",
              CARD_SURFACE,
            )}
          >
            <div
              ref={terms.ref}
              style={terms.style}
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain text-[length:var(--ob-ui)]",
                CARD_INLINE_PAD,
              )}
            >
              <ol className="flex list-none flex-col gap-[clamp(0.4rem,1.15vh,0.85rem)] pl-0">
                {contract.description.map((item) => (
                  <li key={item.point} className="flex min-w-0 flex-col">
                    <p className="leading-snug font-semibold text-black">
                      {item.point}
                    </p>
                    {item.subtext.trim() !== "" && (
                      <p className="text-[0.9em] leading-snug text-zinc-700">
                        {item.subtext}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            <a
              href={`${href("/governance")}#contract`}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "mt-2 shrink-0 self-start text-[length:var(--ob-ui)] font-medium text-green underline underline-offset-2",
                CARD_INLINE_PAD,
              )}
            >
              View full agreement
            </a>
          </div>

          <div
            className={cn(
              "flex shrink-0 flex-col gap-2 border-t border-black/10 py-[clamp(0.55rem,1.4vh,0.95rem)] text-[length:var(--ob-ui)]",
              CARD_SURFACE,
              CARD_INLINE_PAD,
            )}
          >
            <input
              name="signedName"
              type="text"
              autoComplete="name"
              placeholder="Sign your full name"
              aria-label="Sign your full name"
              value={signedName}
              onChange={(e) => onSignedNameChange(e.target.value)}
              className={cn(FIELD, FIELD_IDLE)}
            />

            {error && (
              <p className="shrink-0 font-medium text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>

          <div
            className="grid shrink-0 transition-[grid-template-rows] duration-[380ms] ease-out"
            style={{ gridTemplateRows: received ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <p
                className="flex items-center gap-2 bg-[var(--color-green)] px-6 py-2.5 text-[length:var(--ob-ui)] font-medium text-white sm:px-7"
                role="status"
              >
                <Check className="size-4" aria-hidden />
                Agreement received
              </p>
            </div>
          </div>
        </div>

        <SignedBy inviter={inviter} faces={faces} signedCount={signedCount} />
      </div>
    </div>
  );
}
