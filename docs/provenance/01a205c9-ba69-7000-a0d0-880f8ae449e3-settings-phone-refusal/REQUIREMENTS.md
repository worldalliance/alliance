---
user: Charles Lien
task: Finish ALL-2280, keeping settings saving past a phone number the profile update refuses, from the local branch `sms-settings-refusal`, and open a PR.
---

# Requirements

Part of the phone verification plan in `docs/provenance/01a1dd13-a21d-72ee-9b98-3eb3d46bb30f-verify-member-phone/`; ships before ALL-2259, which adds the unique index `UQ_user_phone_number_live` that makes `POST /user/update` answer a number another live account holds with 409 "This phone number is already linked to an account. Enter a different number."

- Web and mobile settings show that refusal on the phone field and leave the refused number out of saves while it is the number entered, so the member's other edits (time zone, city, notification settings) keep saving. (ALL-2280-proposed, user-approved)
- A 409 to a save that sent a number is the refusal of the number it sent, so a refusal that lands after the member typed another number leaves the new one alone. (ALL-2280-proposed, user-approved)
- Editing the phone field clears the refusal, so a member who frees the number on their other account and re-enters it has it sent again rather than shown the old refusal. (ALL-2280-proposed, user-approved)
