# Evidence

## Research (checked 2026-11-22)

Question: established practice for optional phone confirmation, telling a user a contact detail is unconfirmed, and saving or replacing unconfirmed contact details. Done by a researcher subagent; claims are what each page says.

- NIST SP 800-63B rev. 4 (formal standard), https://pages.nist.gov/800-63-4/sp800-63b.html: §3.1.3.3 treats setting or changing a pre-registered phone number as binding a new authenticator. Applies only to a number used to sign in; the Alliance's member number is a contact channel, so it does not apply.
- GOV.UK Design System, "Confirm a phone number" (government design system), https://design-system.service.gov.uk/patterns/confirm-a-phone-number/: send a new code on request, keep the previous one valid within its time limit, note that texts can take a few minutes, let the user check and change the number. It has no skip and no unverified state.
- Twilio Verify developer best practices (vendor recommendation), https://www.twilio.com/docs/verify/developer-best-practices: "Wait until the information has been verified to store it in your database"; show the full number so typos can be caught; rate-limit sends.
- WCAG 2.2 SC 4.1.3 Status Messages (formal standard), https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html: status messages that appear without a change of context are announced to assistive technology without moving focus.
- Zendesk (common practice, one product), https://support.zendesk.com/hc/en-us/articles/10687245003930: an "unverified" icon beside the email address. No design system checked (Material, Atlassian, Polaris) covers unverified contact details.
- GitHub (common practice, one product), https://docs.github.com/en/account-and-profile/how-tos/email-preferences/changing-your-primary-email-address: a new primary email is added beside the old one and verified.
- No source found covers optional, non-blocking confirmation of a contact number.

## Repository measurements

- Email is not a fallback for a text that cannot be delivered (read 2026-11-22 at commit 07cad9d792): `server/src/notification-settings/external-channels.ts` picks push, text and email independently from the member's preferences; text only needs `textReachable` (`server/src/user/user.utils.ts`), a canonical number not marked unsubscribed, and knows nothing of Twilio refusing a country. New accounts start with action-update texts and emails off (`NEW_ACCOUNT_OFF` in `server/src/notification-settings/notification-preferences.service.ts`).
- Production confirmed numbers: 0 of 456 live accounts with a number, per `docs/provenance/01a2060c-947a-7000-aef8-45b096276330-phone-code-per-account/EVIDENCE.md`, measured 2026-11-22.
