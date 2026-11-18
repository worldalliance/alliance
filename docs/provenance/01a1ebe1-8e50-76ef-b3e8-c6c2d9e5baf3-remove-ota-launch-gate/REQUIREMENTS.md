---
user: Charles Lien
task: Fix ALL-2296 (the iOS OTA launch gate reads a null checkError as a failed check), with research on industry standard weighted most
---

- **User-originated:** Established practice found by research takes precedence over other agents' views when deciding how mobile applies over-the-air updates.
- **User-approved (option from a researcher, a brainstormer and a codex second opinion):** An over-the-air update applies on the next cold start after it downloads. The cold-start launch gate, which held the first screen so an update downloaded at launch ran on the same launch, is removed. The existing restart banner ("A new version of Alliance is ready.") is the faster path, including for an update downloaded at launch. This supersedes "The existing cold-start update gate stays as it is" in `docs/provenance/01a1c8a3-dd75-7277-a5e1-680acca0b111-in-session-update-prompt/REQUIREMENTS.md`.
- **User-approved (agent proposal):** A path that forces an update to land is added only when an update first has to, enforced by the server through a minimum version rather than by update timing.
- **User-approved (agent proposal), narrowed by the user:** Every mobile analytics event says which over-the-air update the device is running, so the update a fleet runs can be checked per platform in PostHog by hand. No alert.
- **User-approved (agent proposal):** The rewritten Linear issue ALL-2296 is the incident record: the cause, the ruled-out theories marked disproved or unsupported, and a link to the fix. No separate postmortem.
- **User-originated:** No issue is filed upstream with Expo.
