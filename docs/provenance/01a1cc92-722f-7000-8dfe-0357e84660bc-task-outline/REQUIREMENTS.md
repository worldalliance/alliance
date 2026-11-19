---
user: chonboncode
task: Show a task outline on the task card of active, unfinished tasks, on the tasks page and the project page
---

Origins: **User** is the user's own request.

- A task outline shows on the task card on the tasks page and on the project (action) page. (User)
- It shows only for active, unfinished tasks: not for old tasks, and not for completed tasks. (User)
- The outline lists the header of each page of the task, one line per page. It uses the page's header, not the page's title. (User)
- When several pages share the same header text, the outline lists that header once, at its first page, so a long step can be split across pages under one header. (User)
- A page with no showing header is left out of the outline, rather than listed under a generic title. Task pages are expected to open with a header. (User)
- A task past its deadline that the member can still complete keeps its outline. (User)
- It displays as a timeline: a dot beside each line, with a line joining each step to the next. (User)
- Every step of the outline sits above the begin button. The outline and the begin button appear together once the outline is ready, so the begin button never moves when the outline arrives. (User)
- The dots are filled in, matching every other timeline-style component in the app. (User)
- The outline shows no time estimate for its steps, and pages carry no time estimate. (User)
- Web and mobile both show it, each fitting its platform (`apps/AGENTS.md` web-mobile parity). (User)
- In the admin form builder, the sidebar's header block editor shows, under the header text field: "Write headers in the active voice: “Select a date”, not “Date selection”." The canvas's inline header editor doesn't show it. (User)
