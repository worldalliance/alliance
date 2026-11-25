---
user: chonboncode
task: Fix two problems with the project update cards shipped in docs/provenance/01a1f44f-786e-7000-825e-995af647ada7-home-updates-carousel: the activity section sits too far below the task card, and a tall photo makes a card taller than its neighbours.
---

# Requirements

- On the web tasks page, the activity section sits under the task card with the spacing it had before the update cards shipped. (user-originated)
- Every update card is the same size whatever its photos' proportions: the photo area keeps its 3:2 shape and crops a photo that doesn't fit, on the tasks page and on the full "Project updates" list, where a tall photo must not stretch the cards beside it. (user-originated)
