import type {
  ContractDto,
  ProfileDto,
  ReferrerProfileDto,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { Check } from "lucide-react";
import type { RefObject } from "react";
import { href, Link } from "react-router";
import { riseStyle, StepHeadline } from "./chrome";

export const AGREEMENT_HEADLINE = "Help us build a network of reliability.";

export const COMMITMENT_STATEMENT =
  "I commit to complete each task to the best of my ability.";

/** Typed out rather than ticked, so agreeing takes a deliberate act. */
export const COMMIT_PHRASE = "I commit";

export function isCommitted(typed: string): boolean {
  return typed.trim().toLowerCase() === COMMIT_PHRASE.toLowerCase();
}

const DETAILS_LINK = "View more details";

/** Overlapping faces stop fitting the panel's width past this on a phone. */
const FACE_COUNT = 5;

/** Matches `AvatarProfile`'s square sizes, which never go round. */
const FACE =
  "size-[clamp(1.75rem,3.6vh,2.5rem)] rounded ring-2 ring-[var(--ob-navy)]";

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
    <div className={cn("flex shrink-0 flex-col items-center gap-2", className)}>
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
      <p className="text-center text-[length:var(--ob-ui)] leading-snug text-pretty text-white">
        {inviter ? (
          <>
            <span className="font-medium">{inviter.displayName}</span> and{" "}
            {Math.max(signedCount - 1, 0).toLocaleString("en-US")} others have
            signed the agreement.
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

function CommitControl({
  typed,
  onTypedChange,
}: {
  typed: string;
  onTypedChange: (value: string) => void;
}) {
  const done = isCommitted(typed);

  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <label
        htmlFor="commit-phrase"
        className="text-[length:var(--ob-ui)] leading-snug text-black"
      >
        {COMMITMENT_STATEMENT} Type{" "}
        <span className="font-semibold">{COMMIT_PHRASE}</span> to agree.
      </label>
      <div className="relative">
        <input
          id="commit-phrase"
          name="commitPhrase"
          type="text"
          autoComplete="off"
          placeholder={COMMIT_PHRASE}
          value={typed}
          onChange={(e) => onTypedChange(e.target.value)}
          className={cn(
            "h-[clamp(2.1rem,4.4vh,2.75rem)] w-full rounded-md border-2 bg-white px-3.5 pr-10 text-black outline-none transition-colors placeholder:text-zinc-400",
            done
              ? "border-[var(--color-green)]"
              : "border-zinc-200 focus:border-[var(--ob-navy)]",
          )}
        />
        {done && (
          <Check
            className="absolute top-1/2 right-3 size-5 -translate-y-1/2 text-[var(--color-green)]"
            strokeWidth={3}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

export function AgreementStep({
  contract,
  inviter,
  faces,
  signedCount,
  committed,
  onCommittedChange,
  signedName,
  onSignedNameChange,
  error,
  received,
  receivedBarRef,
}: {
  contract: ContractDto;
  inviter: ReferrerProfileDto | null;
  faces: ProfileDto[];
  signedCount: number;
  /** The raw text the member has typed into the commitment field. */
  committed: string;
  onCommittedChange: (value: string) => void;
  signedName: string;
  onSignedNameChange: (name: string) => void;
  error: string | null;
  /** Only after Join is pressed, which is what the bar confirms. */
  received: boolean;
  receivedBarRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <StepHeadline>{AGREEMENT_HEADLINE}</StepHeadline>
      <div
        className="ob-rise mx-auto flex min-h-0 w-full max-w-[40rem] flex-col gap-[clamp(0.55rem,1.7vh,1.15rem)]"
        style={riseStyle(2)}
      >
        <SignedBy
          inviter={inviter}
          faces={faces}
          signedCount={signedCount}
          className="order-2"
        />

        <div className="order-1 flex shrink-0 flex-col overflow-hidden rounded-lg bg-white">
          <div className="flex min-h-0 flex-col gap-[clamp(0.4rem,1.15vh,0.85rem)] p-[clamp(0.75rem,1.9vh,1.35rem)] text-[length:var(--ob-ui)]">
            {contract.description.map((item) => (
              <div key={item.point} className="flex flex-col">
                <p className="leading-snug font-semibold text-black">
                  {item.point}
                </p>
                {item.subtext.trim() !== "" && (
                  <p className="text-[0.9em] leading-snug text-zinc-700">
                    {item.subtext}
                  </p>
                )}
              </div>
            ))}

            <CommitControl
              typed={committed}
              onTypedChange={onCommittedChange}
            />

            <Link
              to={href("/guide")}
              target="_blank"
              rel="noreferrer"
              className="-mt-1 w-fit text-[length:var(--ob-caption)] text-[var(--color-green)] hover:underline"
            >
              {DETAILS_LINK}
            </Link>

            <input
              name="signedName"
              type="text"
              autoComplete="name"
              placeholder="Sign your full name to agree"
              aria-label="Sign your full name to agree"
              value={signedName}
              onChange={(e) => onSignedNameChange(e.target.value)}
              className="h-[clamp(2.1rem,4.4vh,2.75rem)] w-full shrink-0 rounded-md border border-zinc-300/80 bg-zinc-100! px-3.5 text-black outline-none transition-colors placeholder:text-zinc-500 focus:border-[var(--ob-navy)] focus:bg-white!"
            />

            {error && (
              <p className="shrink-0 font-medium text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>

          <div
            className="grid transition-[grid-template-rows] duration-500 ease-out"
            style={{ gridTemplateRows: received ? "1fr" : "0fr" }}
          >
            <div ref={receivedBarRef} className="overflow-hidden">
              <p
                className="flex items-center gap-2 bg-[var(--color-green)] px-6 py-2.5 text-[length:var(--ob-ui)] font-medium text-white sm:px-7"
                role="status"
              >
                <Check className="size-4" aria-hidden />
                Agreement Received
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
