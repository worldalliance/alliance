Use the existing Alliance member count hook, matching other public site sections. Show the count and launch threshold below the funding total, with a green bar matching the page.

Cap the bar at 100% while retaining the full count in its label. Show loading or error text while the count is unavailable.

Allow the hero to grow beyond the viewport to accommodate the bar on small screens. This public project route has no mobile app counterpart.

Share the member progress component between the project page and onboarding card. Replace the card's hard-coded task preview count with the live display beneath the project title, avoiding conflicting counts. Both desktop and narrow-screen onboarding use this card.

The member count hook throws on an error response instead of resolving to 0. Web's client doesn't throw by default, so a 500 used to render "0 / 1,000 members" and the error text never showed. Every other caller already handles a missing count, and mobile's client already threw. It retries once, not react-query's default three: three retries kept "Loading member count..." up for about 7 seconds before the error text showed.

The bar reuses `CompletedBar`, which now passes through div attributes and a class for the track, so the dark page can set its own track color and the progressbar ARIA.

The onboarding info session button is gone because the session it linked to, September 14, 2026 at 9am PT, has passed.

The project page's lead paragraph, its meta description, and the launch threshold line read the goal from `MEMBER_GOAL_LABEL`.
