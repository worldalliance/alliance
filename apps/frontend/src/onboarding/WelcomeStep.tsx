import membersPhoto from "../assets/redesign/members-photo.webp";

export const WELCOME_HEADLINE = "Welcome to The Alliance";
export const WELCOME_SUBLINE = "Let’s build a cooperative future.";

export function WelcomeBackdrop() {
  return (
    <>
      <img
        src={membersPhoto}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-[#2d5a22]/75" aria-hidden />
    </>
  );
}

export function WelcomeStep({
  memberNumber,
  onContinue,
}: {
  memberNumber: number;
  onContinue: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onContinue}
      aria-label="Continue"
      className="relative flex size-full cursor-default flex-col items-center justify-center gap-2 px-6 text-center focus:outline-none"
    >
      <h1
        className="ob-rise text-[length:var(--ob-h1)] leading-[1.2] font-normal text-white"
        style={{ animationDelay: "240ms" }}
      >
        {WELCOME_HEADLINE}
      </h1>
      <p
        className="ob-rise text-[length:var(--ob-body)] text-white"
        style={{ animationDelay: "410ms" }}
      >
        {WELCOME_SUBLINE}
      </p>
      <p
        className="ob-rise mt-3 text-[length:var(--ob-h2)] leading-snug text-balance text-white"
        style={{ animationDelay: "620ms" }}
      >
        You are member {memberNumber.toLocaleString("en-US")}. We’re glad you’re
        here.
      </p>
    </button>
  );
}
