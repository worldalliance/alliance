---
user: Charles Lien
task: Kora participant signup and login
---

# Kora participant signup and login

## R1. Purpose and boundary

Origin: user.

Create a separate backend entity for non-member participants in the Kora project. Registration creates a limited participant account, not an Alliance waitlist entry or member account. Participants will eventually use a public task resembling the Apgard task at a larger scale, and should eventually be able to convert to membership easily.

This spec covers participant signup and login only. Implementing the task, authorizing task access, and converting participants to membership are outside this work. Participant registration requires no invitation or referral code.

## R2. Entry point and availability

Origin: agent-proposed, user-approved.

Use the existing `/projects/safer-chatbots-for-children` page. Support desktop and mobile browsers; native mobile integration is outside this work. Enable signup where the page is available by replacing its closed waitlist signup form with participant signup, while retaining the page's production visibility restriction.

For a visitor already authenticated as an Alliance member, hide the participant form and display exactly: “You’re already an Alliance member.” Determine this from the current member session, without checking whether an entered email address or phone number belongs to a member.

## R3. Participant information

Origin: agent-proposed, user-approved.

Collect a full name and exactly one contact method: email address or mobile number. Detect timezone automatically. Do not request a password or additional participant profile information.

## R4. Unified signup and login

Origin: agent-proposed, user-approved.

Provide one “Continue” flow for new and returning participants:

- Email or phone: verify the contact with a one-time code before asking a new participant for their name. A returning participant signs in without entering their name again.
- Google or Apple: use the provider's verified email and supplied name. Ask for a name when the provider does not supply one.
- Email OTP, Google, and Apple sign-ins proving the same verified email open the same participant account and automatically connect those sign-in methods.
- Different email addresses, including Apple relay addresses, and phone numbers remain separate identities. Linking different contacts is outside this work.

Offer all four methods initially: email OTP, SMS OTP, Google OAuth, and Apple OAuth.

## R5. OTP behavior

Origin: agent-proposed, user-approved.

- Codes contain six digits and expire after ten minutes.
- Five incorrect attempts invalidate a code.
- Resending is available after sixty seconds; a new code replaces the previous code.
- Apply request limits per contact and per IP address.
- Accept international mobile numbers with a country selector wherever the SMS provider can deliver. Keep email and OAuth available when SMS delivery fails.

## R6. Signed-in state and sessions

Origin: agent-proposed, user-approved.

After signup or login, stay on the project page and show a signed-in confirmation containing the participant's name and a sign-out control. A task page or separate participant dashboard is not part of this release.

End a browser session after thirty days without activity. Allow simultaneous sessions on multiple devices. Signing out ends only the current browser's participant session.

## R7. Account-management scope

Origin: agent-proposed, user-approved.

Initial account controls are signup, login, and sign-out. Defer profile edits, contact changes, linking different contacts, and lost-contact recovery. No membership invitation policy or phone-only membership policy is selected by this spec.

## R8. Code messages

Origin: agent-proposed, user-approved, except reuse, which is user-originated.

Brand codes as the Alliance, not KORA. New and returning participants receive identical wording.

- Email subject: “Your sign-in code is {code}”. Body: “Enter {code} to continue to Safer Chatbots for Children.” then “This code expires in 10 minutes. If you didn’t request it, you can ignore this email.”
- SMS: “Your Alliance sign-in code is {code}. It expires in 10 minutes.”, a blank line, then `@{site host} #{code}` so browsers can offer the code for autofill.

The code-sending and checking machinery is reusable for other one-time codes on the same site, each with its own wording.

## R9. Delivery and launch switches

Origin: user.

Code delivery keeps the existing delivery gate: production, or `SEND_DEV_NOTIFS=1` elsewhere. Enabling the flow later should take one switch.
