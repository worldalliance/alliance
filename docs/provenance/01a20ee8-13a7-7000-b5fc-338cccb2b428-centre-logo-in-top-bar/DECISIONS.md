# Decisions

- The logo is centred in the top bar's height in the normal layout too, not only while the task flow is open. The nav rail sits beside the top bar in both layouts, and moving the logo only while the flow is open would make it jump about 9px each time the flow opened or closed. (agent decision)
- The logo's row takes its height from `--navbar-top-bar-height`, the value `NavbarTopBar` already measures, so the logo follows the bar if the bar's height changes. (agent decision)
- The margin below the logo grows from `mb-12` to `md:mb-13`, so the nav items keep their position (108.75px from the top at a 15px root size). (agent decision)
- Below `md`, the rail is a full-screen drawer with no top bar beside it, so its layout is unchanged. (agent decision)
