---
user: Charles Lien
task: Specify email or phone contact for waitlist signup
---

## User requests

- Add phone contact to the waitlist joining form while avoiding extra fields. The user suggested a combined “preferred contact” input accepting email or phone, noted that backend storage would change, and requested copy advice.
- Use the spec skill to interview and document the feature. Application implementation is a separate request.
- Inspect the repository's existing phone functions before deciding international number behavior.

## Approved agent proposals

These choices originated with the agent. The user approved questions 1, 2, and 4–7 individually, then approved all recommendations in the revised list covering 3 and 8–14. The country-selector choice below is the revised proposal accepted after inspecting the shared helpers.

### Signup and contact purpose

- Replace the email field with one combined contact input. Keep the name, reason, and commitment controls and their existing requirements.
- Phone contact means texts sent manually by staff initially. Contact details are for waitlist updates and the eventual invitation.
- Show a compact country selector within the contact input row when the input resembles a phone number. Default to US, recognize explicit international prefixes, and support national formats through country selection.
- Reuse existing phone validation. Ask for a mobile number in the label, but accept valid numbers without carrier lookups or stricter number-type filtering.
- Joining requires no verification code. Format validation does not establish ownership or SMS reachability.
- Collect exactly one contact method. Defer contact editing and merging. Equivalent normalized contacts identify one entry; repeated signup retains its original data and referral attribution. Separate email and phone submissions remain separate entries.

### Copy

| Location                      | Approved text                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Contact label and placeholder | Email or mobile number                                                                  |
| Helper                        | Where should we send your invitation?                                                   |
| Invalid contact               | Enter a valid email address or mobile number.                                           |
| Confirmation title            | You’re on the waitlist.                                                                 |
| Confirmation body             | We’ll be in touch when you can join the Alliance.                                       |
| Below the button              | By joining, you agree to receive waitlist updates and your invitation by email or text. |

### Referral links and manual outreach

- Show a new phone entrant their personal referral link immediately and remember their waitlist state in the browser.
- Recovering that link from another browser requires staff assistance initially. Duplicate phone signup shows a generic confirmation without revealing the original referral link. Automated text recovery is deferred.
- Admins can copy an entry's personal referral link to assist with recovery.
- Add an individual admin control to create or copy an entry's signup invitation. Staff use the existing manual mobilization action after outreach; copying alone does not mark the entry mobilized.
- Staff can mark a phone entry unsubscribed when asked to stop contact. Repeating signup with that number does not resubscribe it.
- Bulk invitation export is deferred.

### Admin and storage

- Display and search phone numbers. Add an Email/Phone filter that also works in saved cohorts.
- Explicitly count phone entries skipped by email previews. Preserve existing tags, counts, spam handling, and status controls for both contact methods.
- Store separate nullable `email` and `phoneNumber` columns, with exactly one populated and uniqueness per normalized contact. Preserve all existing email entries and their history.

### Scope

- Cover the public web waitlist, including mobile browsers, the backend, and admin.
- Entrants accepting an invitation use the existing email/OAuth account signup.
- Native mobile waitlist screens, phone-based accounts, automated waitlist texting, contact editing/merging, and bulk invitation export are outside this version.
