---
user: Alex Dorey
task: Diagnose a reload loop caught on a Sept 8 screen recording and stop a migrated member bouncing between worldalliance.org and thealliance.org
---

- Analyze an attached iOS screen recording from Sept 8 (`ScreenRecording_09-08-2026 19-18-54_1.MOV`) and look at `main` to find why it might have happened.
- Stated as context for the diagnosis: the member in the recording has likely opted in to the domain switch from worldalliance.org to thealliance.org.
- Approved all three fixes the agent proposed at the end of its diagnosis ("I like all 3 of these suggestions. Please implement them"). The agent's proposals, quoted so the approval can be read without the transcript:
  1. "Guard the hop — stash the attempt in `sessionStorage` and, on a second load of the legacy domain with the marker present, stop redirecting and show the modal (or a plain link) instead."
  2. "Assert the origin actually changes before assigning, so a config slip can't produce a same-URL reload."
  3. "Block the legacy-domain sign-in for a user with `switchedDomainAt` set, server side, and redirect that login to the new domain rather than authenticating and bouncing."

- Change the migration date in the copy from September 15th to September 17th.
- Write a brief commit message for the changes.
- Write provenance docs covering this thread and any other changes in commit `212ea9048`.
