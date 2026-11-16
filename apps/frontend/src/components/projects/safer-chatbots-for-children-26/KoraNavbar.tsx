import type { KoraParticipantDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { DropdownMenuItem } from "@alliance/sharedweb/ui/DropdownMenu";
import { Menu } from "@base-ui/react/menu";
import { Popover } from "@base-ui/react/popover";
import { ChevronDown, LogOut } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../../../lib/AuthContext";
import { HOME_HREF } from "../../../site/links";
import { Navbar } from "../../../site/Navbar";
import {
  Logotype,
  SITE_BUTTON,
  SITE_BUTTON_DARK,
  SITE_BUTTON_STYLE,
} from "../../../site/ui";
import { koraRefusalMessage, useKoraParticipant } from "./useKoraParticipant";

export const ALLIANCE_BLURB =
  "A global group of people who spend 15 minutes a week on actions that measurably improve the world.";

// The site navbar is z-[90], above the shared popover tier.
const POPUP_LAYER = "z-[91]";
// Portaled outside SiteRoot, so `site-root` restores the site font.
const POPUP =
  "site-root rounded-md border border-zinc-200 bg-white text-zinc-900 shadow-lg outline-hidden";

function AllianceBrand() {
  return (
    <Popover.Root>
      <Popover.Trigger className="inline-flex min-h-11 items-center gap-1.5 text-xl">
        <Logotype />
        <ChevronDown className="size-4" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className={POPUP_LAYER}
          align="start"
          sideOffset={4}
        >
          <Popover.Popup
            aria-label="About the Alliance"
            className={cn(POPUP, "flex max-w-xs flex-col gap-3 p-4 text-base")}
          >
            <p>{ALLIANCE_BLURB}</p>
            <Link to={HOME_HREF} className="font-medium underline">
              Learn more about the Alliance
            </Link>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ParticipantMenu({ participant }: { participant: KoraParticipantDto }) {
  const { signOut } = useKoraParticipant();
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(SITE_BUTTON, SITE_BUTTON_DARK, "max-w-64")}
        style={SITE_BUTTON_STYLE}
      >
        <span className="truncate">{participant.name}</span>
        <ChevronDown className="size-4 shrink-0" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={POPUP_LAYER} align="end" sideOffset={4}>
          <Menu.Popup className={cn(POPUP, "min-w-48 p-1")}>
            <Menu.Group>
              <Menu.GroupLabel className="px-3 py-2 text-sm text-zinc-600">
                Signed in as {participant.maskedContact}
              </Menu.GroupLabel>
              <DropdownMenuItem
                closeOnClick={false}
                disabled={signOut.isPending}
                onClick={() => signOut.mutate()}
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </DropdownMenuItem>
            </Menu.Group>
            {signOut.isError && (
              <p
                role="alert"
                className="max-w-48 px-3 py-2 text-sm text-red-700"
              >
                {koraRefusalMessage(signOut.error)}
              </p>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function KoraNavbar({
  hideNavLinks = false,
}: {
  hideNavLinks?: boolean;
}) {
  const member = useAuth();
  const participant = useKoraParticipant().query.data?.participant;
  return (
    <Navbar
      hideNavLinks={hideNavLinks}
      brand={<AllianceBrand />}
      account={
        participant && !member.isAuthenticated ? (
          <ParticipantMenu participant={participant} />
        ) : undefined
      }
    />
  );
}
