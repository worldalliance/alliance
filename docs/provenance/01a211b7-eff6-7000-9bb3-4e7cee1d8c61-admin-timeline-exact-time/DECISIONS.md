# Decisions

## One scale for every x position

`timelineScale(globalStartDate, pixelsPerDay)` in `apps/admin/src/lib/actionTimelineData.ts` turns an instant into an x position, and the phase bars, the "now" marker, reminder markers and windows, the focus indicator, the scroll-to-focus and scroll-to-now effects, and the week ticks all use it. Before, each computed its own offset; one function keeps them on the same scale (agent decision).
