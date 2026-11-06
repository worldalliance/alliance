# Campaign invite page description

- The text is stored on `Campaign` as nullable `invitePageDescription`, maxlength 200. Blank and whitespace-only values are stored as null. (agent)
- Create and update DTOs both accept the field so a later edit can set or clear it. The Share Links UI only collects it on create, which is what was asked. (agent)
- The public referrer profile carries `invitePageDescription` (null for a user, or for a campaign that has none). The signup screens already load that profile through `useInvite`. (agent)
- Web and mobile signup both show the line. `apps/AGENTS.md` requires feature parity. The marketing `/invite` page is a different screen and is unchanged. (agent)
- A campaign picture, when present, sits beside the description the way a member avatar sits beside "X invited you to the Alliance". Without a picture, the description is the whole line. (agent)
- The Organizations admin creator does not get this field. It creates organization-kind campaigns for the waitlist, not Share Links signup campaigns. (agent)
