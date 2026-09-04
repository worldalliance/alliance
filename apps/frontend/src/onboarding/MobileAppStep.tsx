import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { Smartphone } from "lucide-react";
import { riseStyle, StepHeadline, StepNote } from "./chrome";

export const APP_HEADLINE_MOBILE = "Most members do this in the app.";

export const APP_HEADLINE_DESKTOP = "Most members do this from their phone.";

const APP_NOTE_MOBILE =
  "The app is where reminders land, and it takes about a minute to install.";

const APP_NOTE_DESKTOP =
  "Reminders land in the app, so look for the Alliance in the App Store or on Google Play next time you have your phone to hand.";

const IOS_URL = "https://apps.apple.com/app/id6760088194";

const ANDROID_URL =
  "https://play.google.com/store/apps/details?id=com.alliance.alliancemobile";

const NAV = "min-h-11 gap-2 rounded-lg px-6 sm:min-w-[13rem]";

function storeUrl(): string {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return ios ? IOS_URL : ANDROID_URL;
}

export function MobileAppStep() {
  return (
    <>
      <span
        className="ob-rise mx-auto flex size-[clamp(2.75rem,6vh,4.5rem)] shrink-0 items-center justify-center rounded-xl bg-white/15 text-white"
        style={riseStyle(1)}
        aria-hidden
      >
        <Smartphone className="size-[55%]" />
      </span>
      <StepHeadline index={2}>
        <span className="sm:hidden">{APP_HEADLINE_MOBILE}</span>
        <span className="hidden sm:inline">{APP_HEADLINE_DESKTOP}</span>
      </StepHeadline>
      <StepNote index={3}>
        <span className="sm:hidden">{APP_NOTE_MOBILE}</span>
        <span className="hidden sm:inline">{APP_NOTE_DESKTOP}</span>
      </StepNote>
    </>
  );
}

/** The download only shows where it can be acted on, so desktop just continues. */
export function MobileAppFooter({ onContinue }: { onContinue: () => void }) {
  return (
    <div
      data-ob-nav
      className="ob-rise mx-auto flex w-fit shrink-0 gap-3"
      style={{ ...riseStyle(4), marginTop: "var(--ob-band-gap)" }}
    >
      <Button
        color={ButtonColor.WhiteBorderless}
        className={`${NAV} border-transparent bg-white text-(--ob-tone-ink) sm:hidden`}
        onClick={() => window.open(storeUrl(), "_blank", "noreferrer")}
      >
        Download app
      </Button>
      <Button
        color={ButtonColor.Outline}
        className={`${NAV} border-white/70 bg-transparent text-white hover:bg-white/10 sm:border-transparent sm:bg-white sm:text-(--ob-tone-ink)`}
        onClick={onContinue}
      >
        Continue
      </Button>
    </div>
  );
}
