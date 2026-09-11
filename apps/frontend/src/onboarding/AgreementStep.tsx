import type {
  ContractDto,
  ProfileDto,
  ReferrerProfileDto,
} from "@alliance/shared/client";
import { isConfirmationCloseEnough } from "@alliance/shared/lib/contract";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { Check } from "lucide-react";
import { riseStyle, StepHeadline, StepNote } from "./chrome";

export const AGREEMENT_HEADLINE =
  "Join a group of people who can count on each other.";

export const AGREEMENT_NOTE =
  "This agreement is core to our planning ability. Once you enter it, you become a member.";

/** Typed out rather than ticked, so agreeing takes a deliberate act. */
export const COMMIT_PHRASE = "I commit to complete each task on time";

export function isCommitted(typed: string): boolean {
  return isConfirmationCloseEnough(typed, COMMIT_PHRASE);
}

/** Overlapping faces stop fitting the panel's width past this on a phone. */
const FACE_COUNT = 5;

/** Matches `AvatarProfile`'s square sizes, which never go round. */
const FACE =
  "size-[clamp(1.5rem,3.1vh,2.1rem)] rounded ring-2 ring-[var(--ob-navy)]";

const FIELD =
  "h-[clamp(2.1rem,4.4vh,2.75rem)] w-full shrink-0 rounded-md border-2 bg-white px-3.5 text-black outline-none transition-colors placeholder:text-zinc-400";

const FIELD_IDLE = "border-zinc-200 focus:border-[var(--ob-navy)]";

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

function CommitControl({
  typed,
  onTypedChange,
}: {
  typed: string;
  onTypedChange: (value: string) => void;
}) {
  const done = isCommitted(typed);

  return (
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
          FIELD,
          "pr-10",
          done ? "border-[var(--color-green)]" : FIELD_IDLE,
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
}) {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[40rem] flex-col justify-center gap-[clamp(0.55rem,1.7vh,1.15rem)] lg:max-w-none lg:grid lg:grid-cols-2 lg:items-center lg:gap-12 xl:gap-16">
      <div className="flex shrink-0 flex-col items-center gap-[clamp(0.4rem,1.2vh,0.85rem)] lg:max-w-[28rem] lg:items-start">
        <StepHeadline className="lg:mx-0 lg:text-left">
          {AGREEMENT_HEADLINE}
        </StepHeadline>
        <StepNote className="lg:mx-0 lg:text-left" index={2}>
          {AGREEMENT_NOTE}
        </StepNote>
      </div>

      <div
        className="ob-rise mx-auto flex min-h-0 w-full max-w-[40rem] flex-col gap-[clamp(0.55rem,1.7vh,1.15rem)] lg:mx-0 lg:justify-self-end"
        style={riseStyle(3)}
      >
        <div className="flex shrink-0 flex-col overflow-hidden rounded-lg">
          <div className="flex min-h-0 flex-col bg-white/95 p-[clamp(1.15rem,2.8vh,2rem)] text-[length:var(--ob-ui)]">
            <ol className="flex list-none flex-col gap-[clamp(0.4rem,1.15vh,0.85rem)] pl-0">
              {contract.description.map((item, index) => (
                <li key={item.point} className="flex gap-x-3">
                  <span className="flex size-[clamp(1.5rem,3.4vh,1.85rem)] shrink-0 items-center justify-center rounded bg-[var(--ob-navy)] text-[0.85em] leading-none font-semibold text-white tabular-nums">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <p className="leading-snug font-semibold text-black">
                      {item.point}
                    </p>
                    {item.subtext.trim() !== "" && (
                      <p className="text-[0.9em] leading-snug text-zinc-700">
                        {item.subtext}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex min-h-0 flex-col gap-2 bg-white p-[clamp(1.15rem,2.8vh,2rem)] text-[length:var(--ob-ui)]">
            <label htmlFor="commit-phrase" className="leading-snug text-black">
              Type <span className="font-semibold">{COMMIT_PHRASE}</span> to
              enter the agreement.
            </label>
            <div className="flex flex-col gap-1.5">
              <CommitControl
                typed={committed}
                onTypedChange={onCommittedChange}
              />
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
            </div>

            {error && (
              <p className="shrink-0 font-medium text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>

          <div
            className="grid transition-[grid-template-rows] duration-[380ms] ease-out"
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
