---
user: markzxu
task: "timeline doesn't reflect actual time, is rounded to days weirdly" — the admin's actions timeline at `/actions`.
---

# Requirements

- The admin actions timeline (`ActionTimeline` at `/actions`, also used on suite pages) places each phase bar at the real instants its phase starts and ends, instead of rounding them to the start of a day. A phase starting at 7 pm starts at 7 pm on the timeline's scale, not at the midnight before. (user-originated)
- The "now" marker and the bar boundaries sit on the same exact-time scale as the bars, so a bar for a phase that started just now starts at the "now" marker, not at the week line before it. (user-originated)
