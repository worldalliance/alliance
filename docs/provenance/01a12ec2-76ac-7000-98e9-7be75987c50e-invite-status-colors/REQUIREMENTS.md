---
user: Charles Lien
task: One label and color per invite status, shared by web, mobile, and admin
---

## Requirements

- Duplicated code is consolidated where the copies should change together, so a later change applies to every copy and behavior cannot diverge. (user-originated)
- Each invite status set (one-time invites, community invites) has one record in `shared/` giving every status its label and Tailwind/NativeWind text color class, and every site that shows an invite status's label and color reads it from there. (user-originated)
- The class names in the shared records resolve in both the web and mobile Tailwind builds. (user-originated)
- One color scheme across apps, chosen after checking provenance: an accepted invite is green (`text-green`) and a pending invite is amber (`text-amber-500`). (user-originated: consistent scheme; agent-proposed: which one)
- The visible change on the web app is verified in the browser and described in the PR. (user-originated)
- Minimal standalone commits; a behavior change the consolidation implies is its own commit, ordered so each commit deploys alone. (user-originated)
