# Admin redesign: index

The spec for redesigning the admin panel (`apps/admin`) from a clean slate. Read `REQUIREMENTS.md` first: it is what the user asked for and approved, and the other files serve it.

- `REQUIREMENTS.md`: the user's requirements, each with its origin.
- `DECISIONS.md`: agent decisions and assumptions, with their reasons. It cites the files below.
- `EVIDENCE.md`: outside research on established practice (navigation, page patterns, component libraries, large agent-run migrations), with sources and status labels, plus the task's own measurements of the admin at c722280863.
- `PLACES.md`: the page map. Every one of today's 64 routes and the place, tab or record it moves to, plus the sidebar and the palette's browsable structure.
- `CUJ-SUITE.md`: today's journey for creating tasks and a suite and launching it, and how creating dated events makes tasks visible to members.
- `DATACHECK.md`: every piece of data the reference prototype shows, classed as provided by the server, derivable on the client, or not available, with a substitute for each unavailable item.
- `inventory/{tasks,forms,members,growth}.md`: what staff can do today on each route, with capability IDs and file citations. The redesign is checked against these so nothing is lost.
- `SESSIONS.md`: the agent sessions that worked on this task. The design discussion, including the user's feedback on the prototypes, is in the transcript of the session named there; `agents/skills/provenance/SKILL.md` says how to fetch it.

**The visual reference is not committed.** It is the HTML prototype in `.scratch/greenfield/prototypes/ref/` (open `index.html`) on the machine that built it, along with the four first prototypes beside it. Elsewhere, `PLACES.md` and `DATACHECK.md` describe its structure and data, and its look is described only in `REQUIREMENTS.md` and the transcript.
- `CUJ-TASK.md`: today's journey for creating a task and taking it to launch, with the operations that affect members and their guards, and where the prototype breaks them.
- `STAGING-CHECK.md`: the journeys checked against staging data, counts only.
