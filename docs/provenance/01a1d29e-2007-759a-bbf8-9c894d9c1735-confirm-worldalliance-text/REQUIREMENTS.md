---
user: Charles Lien
task: ALL-2146, keep new worldalliance.org text out of content authored in the admin panel
---

- Saving admin-authored content whose text contains `worldalliance` anywhere first asks the admin to confirm in a dialog; confirming saves it unchanged, cancelling saves nothing. (user-originated)
- Nothing is rewritten automatically on save. This replaces the on-save normalization that ALL-2146 described and that `01a1ccef-8e76-75bb-9655-d39c48ef9c28-finish-thealliance-move` listed as its ratchet step. (user-originated)
- Content already stored is left alone; migrating it is ALL-2147. (user-originated)
- Content members write (forum posts, comments, profiles, messages) is out of scope, as the ALL-2145 inventory decided. (user-approved, from the ALL-2145 inventory)
