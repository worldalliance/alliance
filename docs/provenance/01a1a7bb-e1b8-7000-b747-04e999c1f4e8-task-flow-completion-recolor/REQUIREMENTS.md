---
user: chonboncode
task: Show the web task flow's "Task complete!" screen without green on wide screens, and with a brief green on narrow ones
---

Origins: **User** is the user's own request or answer. **Approved** is an agent proposal the user picked.

- Web only. The mobile app's completion screen is unchanged. (User)
- On wide web screens, the "Task complete!" screen shows in its usual colours from the moment it opens, with no green and no colour animation. (User)
- On narrow web screens the green stays: (User)
  - When the "Task complete!" screen opens, the green fades in from white over 500ms while the title and the text under it fade from dark to white. (Approved)
  - The screen holds at full green for two seconds. (User)
  - The green then fades back to white over 200ms while the title turns green. The screen stays open. (Approved)
  - The green does not shrink into the title on its way out. (User)
  - These fades use the flow's ease-out-quart curve. (Approved)
- In its usual colours, at any width: (User)
  - The background is white.
  - "View tasks" is grey.
  - "Invite a friend" is green.
  - The "Task complete!" title is green.
  - The text under the title is dark.
