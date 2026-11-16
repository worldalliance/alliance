# Decisions

- **The site `Navbar` takes `brand` and `account` slots, and the Kora pages fill them through `KoraNavbar`.** The Kora-specific parts stay in the Kora folder, and every other page renders the navbar unchanged. Agent decision.
- **A signed-in Alliance member on a Kora page keeps the member account button ("My tasks" and profile), even with a participant session in the same browser.** The page already treats that visitor as a member. Agent decision.
- **The blurb is a Base UI `Popover`, and the account menu is a Base UI `Menu`.** Base UI is already in use through `sharedweb/ui/DropdownMenu`. The blurb holds a link rather than actions, so it is a non-modal dialog, not a menu. "Sign out" reuses `DropdownMenuItem`. Agent decision.
- **Both popups sit at `z-[91]`, outside the shared z-index scale.** The site navbar is fixed at `z-[90]`, above the shared popover tier (`z-60`), so a popup at that tier would sit behind the bar. Agent decision.
- **Both popups carry the `site-root` class.** They are portaled outside `SiteRoot`, and without it they fall back to the app font. Agent decision.
- **A failed sign-out keeps the menu open and shows the error inside it.** The page line that used to show this error is gone, and a failure stays visible until the menu closes. Agent decision.
- **"Signed in as" uses the existing OTP masking (`•••0042`, `a•••@example.com`).** The participant-to-contact helper moved to `kora-participant.entity.ts` so the participant response and the admin service share it. Agent decision.
- **The name button truncates past 16rem**, which fits the seeded "Test participant 0000" names whole. The full name stays its accessible name. Agent decision.
- **`KoraSignIn` renders nothing once a participant is signed in.** The project page replaces the sign-in card with the welcome view at that point, so its old "You're signed in" branch only flashed. Agent decision.
- **The mobile app gets no matching change.** It has no participant sign-in or site navbar, only the member review screen. Agent decision, from the existing code.
