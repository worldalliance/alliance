---
user: Charles Lien
task: One source of truth for building and validating a reminder group from CreateReminderGroupDto
---

Origin: user

Deduplicate by likely future change, not by lines deleted: code that should change together lives in one place, so a future change has a single source of truth and behavior cannot diverge. Use judgment rather than deduplicating blindly. Land the item as one standalone commit.

Origin: agent-proposed, user-approved

The reminder group preview (`POST /actions/events/:eventId/checkTentativePlans`), create, and update paths build and validate a reminder group from `CreateReminderGroupDto` through one shared implementation, so the preview shows what saving does and a future rule change applies to all three.

Saving a group that preview rejects fails with a 400, where it previously saved, failed later at send time, or failed with a 500. This covers relative timing (`from_deadline`, `within_relative_range`) with neither a deadline nor an anchor event, and a `within_range` send range whose start is after its end.

The audience is loaded the way saving loads it: the tag only for the tag cohort, the users only for the custom cohort.

Tests cover invalid groups rejected on create and update, and preview and save agreeing on them.
