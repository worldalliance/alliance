---
user: Alex Dorey
task: Revert the change that sent texts to UK numbers from a text ID instead of the phone number, since sending from the text ID is not working.
---

- Texts to UK (`+44`) numbers send from the Twilio phone number, as texts to every other number do, instead of from the alphanumeric sender "The Alliance" that commit ce1e7413f introduced. (user-originated)
