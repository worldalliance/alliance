# Evidence

## Research: a phone number another account already holds

Checked 2026-11-14 by two subagents given the same question independently, one through the `claude` CLI and one through `codex`, the second told not to read the first's report. The question: what should a membership app do when someone enters a phone number another account holds, on a form during onboarding and in settings, where the number is used only for SMS/MMS, is not a login identifier and was not verified by code. Source labels follow root `AGENTS.md` **Established practice**. Neither exercised product flows live; product behaviour is as documented on each provider's own pages.

### Findings both reports reached

- No formal standard prescribes the treatment of a duplicate, unverified, contact-only phone number. OWASP ASVS 5.0 6.6.1 allows phone for authentication only "when the phone number has previously been validated" (formal standard, written about authenticators): <https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/en/0x15-V6-Authentication.md>
- AWS Cognito allows an unverified duplicate and makes a number unique only once verified: "the value that you provide can be in a verified state in only one account", and "If a user verifies an email address or phone number that is already a verified alias on another account, Amazon Cognito transfers the alias to their account and marks the attribute as unverified on the original account." (vendor recommendation): <https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html>
- Cognito can "Keep original attribute value active when an update is pending" (vendor recommendation): <https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-email-phone-verification.html>
- WhatsApp gives a recycled number to whoever verifies it and removes the old account's data (common practice): <https://faq.whatsapp.com/general/24068052>
- Venmo rejects a duplicate at signup and lets a member "verify your ownership of the phone number" to claim it in settings (common practice): <https://help.venmo.com/hc/en-us/articles/217532187-Phone-number-email-is-already-registered-but-I-can-t-sign-up->
- Firebase Admin and Auth0 identifiers reject a duplicate phone outright (vendor recommendation): <https://firebase.google.com/docs/auth/admin/errors>, <https://auth0.com/docs/authenticate/database-connections/flexible-identifiers-and-attributes>
- SMS-focused church CRMs enforce one contact per number: Clearstream "requires each contact to have a unique phone number to prevent them from receiving duplicate messages" (common practice): <https://help.clearstream.io/en/articles/12945374-why-do-some-planning-center-names-not-match-in-clearstream>
- No source supports accepting the answer and silently not saving the number.
- OWASP's enumeration guidance says "This user ID is already in use." is an incorrect registration response, and covers login identifiers only (vendor recommendation): <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html>
- Numbers are reassigned: the FCC sets "a minimum aging period of 45 days" before a disconnected number can be reassigned (formal standard): <https://docs.fcc.gov/public/attachments/FCC-18-177A1.pdf>. The second report could not open this PDF and relied on the eCFR text instead.
- CTIA: opt-in confirmation "can also help prevent messages from being sent to a phone number that does not belong to the Consumer who provided that phone number" (vendor recommendation, industry body): <https://api.ctia.org/wp-content/uploads/2023/05/230523-CTIA-Messaging-Principles-and-Best-Practices-FINAL.pdf>
- Error messages: "explain what went wrong and how to fix it", avoid "please" and "sorry", do not clear fields (research-backed practice, GOV.UK Design System): <https://design-system.service.gov.uk/components/error-message/>. Validate on submit (same source): <https://design-system.service.gov.uk/patterns/validation/>

### Where the reports differed

- Error wording for a refused duplicate: the first proposed naming the cause ("already on another account"); the second proposed neutral wording by default because the explicit form reveals that the number's owner is a member, while noting neutral wording does not remove the inference.
- The second proposed "linked to an account" over "belongs to", since an unverified record does not establish ownership.

### Not established

- No study tests wording for a phone "already in use" error or measures onboarding abandonment from one.
- Neither report examined confirming a number by replying to a text in place of entering a code.
- The TCPA material is a reading of FCC and vendor text, not legal advice.

## Repository measurements

2026-11-14, this worktree at `782025da03`:

- `user.phoneNumber` has no unique index; `user.email` has one over rows where `deletedAt IS NULL` (`server/src/user/entities/user.entity.ts`).
- A member's number is written by a form's phone question (`server/src/tasks/form-profile-answers.service.ts`) and by the profile update that web and mobile settings both call.
- A form's phone question is required or optional per form, set in the form's stored schema, not in code.
- `server/src/otp/` sends and checks one-time codes by email or SMS; its only caller is the KORA sign-in.
- `scripts/anonymize/anonymize.sql` gives each member with a number `'+1555' || lpad(id, 7, '0')`, unique per member; the shared `+15550000000` is written only to `mms` and `mms_optout` rows matching no member.

2026-11-14, production database, reported by the user: `SELECT count(*) FROM (SELECT "phoneNumber" FROM "user" WHERE "deletedAt" IS NULL AND "phoneNumber" IS NOT NULL GROUP BY "phoneNumber" HAVING count(*) > 1) shared;` returns 0, so no two live accounts share a number.
