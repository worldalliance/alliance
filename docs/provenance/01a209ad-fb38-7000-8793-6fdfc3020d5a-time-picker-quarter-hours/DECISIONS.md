# Decisions

- **An answer off the quarter hour shows its quarter hour at or before it** (08:10 shows 8:00 AM), and keeps its exact minute until the member turns a wheel, which then writes a quarter-hour time. Answers can be off the grid because they were saved before the wheel had 15-minute steps, or because they were prefilled from a profile reminder time set in the settings page's per-minute `type="time"` input. Rounding down avoids carrying into the hour or the day. (agent decision)
