---
user: Charles Lien
task: Add the following copy somewhere in a skill: "Label every recommendation, number and claim shown to the owner in chat as researched (name the research page or source and what it actually checked) or agent judgement. A recommendation on a research page can still be agent judgement; say which."
---

- The copy goes in `agents/skills/implement/SKILL.md`, after the handoff paragraph of **Verify before handoff**, since that paragraph says what a handoff reports and the skill is read before most tasks; the user left the skill open (agent decision).
- "Owner" and "research page" stay as the user wrote them, though the repository defines neither (agent decision).
