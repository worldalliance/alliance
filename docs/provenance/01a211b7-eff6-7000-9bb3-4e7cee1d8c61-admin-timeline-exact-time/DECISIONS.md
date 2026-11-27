# Decisions

## Cause

`ActionTimelineBar` drew each phase from `startOfDay(phase.startDate)` to `startOfDay(phase.endDate)`, so a bar began at the midnight before its phase started and ended at the midnight before it ended, while the "now" marker and reminder markers used the exact instant. A code comment justified it ("a week-wide column can't show the time of day an event fires"); no provenance recorded that choice, and the owner's request replaces it (reconstructed from existing code, commit 8357532f4).

## One scale for every x position

`timelineScale(globalStartDate, pixelsPerDay)` in `apps/admin/src/lib/actionTimelineData.ts` turns an instant into an x position, and the phase bars, the "now" marker, reminder markers and windows, the focus indicator, the scroll-to-focus and scroll-to-now effects, and the week ticks all use it. Before, each computed its own offset; one function keeps them on the same scale (agent decision). The bars go through it by `phaseBarBounds`, at their phases' exact instants. `firstRowActiveInWeek` compares exact phase instants with the week's bounds too, so a header click finds the rows whose bars actually overlap that week (agent decision).

## Gridlines follow Pacific time

Phase times are absolute instants and the scale is linear in them, so only the gridlines depend on a zone; the requirement fixes them to Pacific. They use `LAUNCH_TIME_ZONE` with `TZDate`, so `nextTuesday` and `addWeeks` step in Pacific and a tick stays on Pacific midnight across a clock change.

## Tooltips name Pacific times

The bar tooltips and the "now" marker's tooltip format their instants with `inLaunchZone`, the admin's existing Pacific date-and-time format (`Mar 3, 2026 at 7:00 PM PT`), instead of the browser's locale and zone. With the gridlines in Pacific, a browser-zone date could name a different day from the gridline a bar starts on, and a date alone can't show the time of day that now places the bar (agent decision).

## An open last phase names only its start

An action's last phase has no real end, since the timeline draws it to a placeholder a week past the render time, so its tooltip names only its start ("Member action (from …)"); the placeholder would read as a scheduled end (agent decision).

## Bar edges, separators and minimum width

- Touching bars are told apart by a 1px inset `box-shadow` in near-white (`rgba(255, 255, 255, 0.9)`) on the left edge of every bar after a row's first. An inset shadow paints inside the bar, so neither edge moves, and it shows against the grey and the project colours alike; a border would change the box's size or position (agent decision).
- The 20px minimum bar width stays, moved from the CSS `minWidth` into `phaseBarBounds` (`MIN_PHASE_BAR_WIDTH_PX`) so the fade gradient and the tests see the width actually drawn (reconstructed from existing code). It keeps a short last phase visible. The next bar comes later in the DOM and paints over the rest of a short phase's 20px from its own exact start, so the short phase shows only its true width, as the day-snapped bars did before; when the next phase is `completed`, whose bar is transparent, the whole 20px shows and runs past the completion instant, as the CSS `minWidth` did before. Both are a separate change, ALL-2476 (agent decision).
- The fade on a still-running last phase starts at the "now" marker's exact position within the bar, measured from the bar's exact start, so it lines up with the marker on the shared scale (agent decision).
