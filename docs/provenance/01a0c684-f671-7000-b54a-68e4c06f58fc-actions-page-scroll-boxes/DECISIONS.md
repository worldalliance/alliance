---
task: Bound the admin actions page into two scrollable boxes, ordered most-recent-first
---

# Decisions

## "The actions" means the timeline, "the content underneath" means the suite-grouped list

The page renders `ActionTimeline` first and the suite-grouped "All actions" list below it. The
timeline grows one 64px row per action, so it filled the entire viewport and the list below it was
off-screen with no hint it existed. That matches the request's description, so the timeline is the
top box and the suite list is the box underneath.

## Most-recent-first is by latest event date

`ActionTimeline` sorted rows by each action's _first_ event ascending. Recency of a row is its
latest event, so the new order is the last event's date descending. This also matches the caption
already on the page: "ordered by latest event (most recent first)".

## The sort is an opt-in prop, not a global change

`ActionTimeline` is also used by `ActionSuitePage`, where a suite reads as a progression and
oldest-first is right. Added `mostRecentFirst` defaulting to the existing order, set only by
`Actions.tsx`.

## The timeline scrolls internally rather than being clipped by an outer box

Wrapping the timeline in an outer `max-h` + `overflow-y-auto` would have scrolled the date header
and the "Actions" header out of view, since both are `sticky` inside the timeline's own scrollers.
Instead the timeline's name column and chart pane each became a bounded vertical scroller, with the
name column's `scrollTop` synced to the chart's so rows stay aligned with their bars. Assigning a
scroll position that already matches fires no event, so the two-way sync settles immediately.

## 50vh

Half the viewport leaves the suite list clearly visible underneath. `max-h` rather than `h` so a
short timeline gives its unused space to the list.

## Week ticks anchor to midnight, not to the timeline's start

`globalStartDate` is `min(earliest event, now - 2 days)`, so it carries an arbitrary time of day.
The old day ticks were laid out at `index * pixelsPerDay` from it and therefore drifted off real
midnights. Week ticks now start from the first Tuesday at or after `startOfDay(globalStartDate)`
and are positioned by their true offset in milliseconds, so a line sits on the Tuesday it names.

## The header labels weeks

At 16px per day a per-day label no longer fits. Each header cell now spans its full week
(112px) and shows the Tuesday that opens it.

## Bars were left alone

`ActionTimelineBar` derives every position from `pixelsPerDay` and already truncates labels that
outgrow their bar, so the narrower scale needed no change there.

## Why bars sat a day right of the Tuesday lines

Measured, not guessed. `member_action` events are stored at e.g. `2026-09-15 19:00:00-07` —
Tuesday 19:00 Pacific, not Tuesday midnight. That is 79% through Tuesday, which at 16px/day is
12.67px. `ActionTimelineBar` then added a hardcoded `+ 4` gutter to every bar, worth ~1.2h at the
old 80px/day and 6h at 16px/day. Together, 16.67px — one 16px day-column.

Timezone was a third-order contributor. Bar positions come from absolute instants and measured
identically in Pacific, UTC, and Eastern (4289.79px in all three); only the gridlines move, because
they anchor to the viewer's midnight. Between Pacific and UTC that is 5.33px (8h), and in UTC the
event genuinely falls on Wednesday 02:00.

## Snapping lives in ActionTimelineBar, not in the phase data

Only bars snap. The current-time line and the reminder overlays mark instants rather than spans, so
they keep their true positions, and the timeline's own `startDate`/`endDate` still drive sorting and
bounds off real timestamps. Phases are contiguous (`phases[i].endDate === phases[i+1].startDate`),
so snapping both ends of each phase preserves that. Tooltips still carry the true timestamps.

## Snapping cannot underflow the chart

`globalStartDate` already carries a one-day `defaultPadding`, and snapping moves a bar back by less
than one day, so a snapped bar cannot land left of the chart origin.

## The fade gradient re-anchored to the drawn bar

`shouldFade` still tests real time, but the gradient's origin moved from `phase.startDate` to the
snapped `barStart` so the fade starts where the bar actually starts.

## Known consequence of viewer-local boundaries

A Tuesday 19:00 Pacific launch is Wednesday 02:00 UTC, so a viewer whose clock is UTC or further
east sees these bars snap to Wednesday, one column right. Verified: 0px off the Tuesday line in
America/Los_Angeles, 16px in UTC. Pinning the component to a fixed timezone is the fix if that ever
matters.
