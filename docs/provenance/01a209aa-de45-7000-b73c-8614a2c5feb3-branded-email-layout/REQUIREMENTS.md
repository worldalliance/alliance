---
user: chonboncode
task: Apply a simple branded HTML design to every automatic email, then send an example of each to the user for copy review.
---

# Requirements

- Every automatic email the server sends renders in one shared branded design. (user-originated)
- The design is simple: the email's text, then its link shown as a call-to-action button, then the Alliance logo. (user-originated)
- The button matches the website's green "Sign up" button: background `#62a124`, white text, TT Neoris 16px at weight 500, 44px tall, 6px corner radius, no border, no arrow. (user-originated)
- The button spans the full width of the content column. (user-originated)
- The logo matches the website's logotype: "The Alliance" in Libre Caslon Text, bold, 0.02em letter spacing, black, 20px. (user-originated)
- Under the logo sit subtle grey links to the website's pages, evenly spaced: Home, People, Guide, Progress, Partner. (user-originated)
- The space above the logo equals the space below the footer content. (user-originated)
- The emails' text stays as it is except where the copy changes below say otherwise. (user-originated)
- An example of every automatic email is sent to the user. (user-originated)

## Copy changes

- Welcome: "If you didn't create this account, please ignore this email." moves under the button as small grey text. (user-originated)
- Password reset and set: "If you didn't ask to reset your password, please ignore this email." and its "set" twin are small grey text under the button. (user-originated)
- One-time code: the code shows large and bold, like the welcome email's "Welcome!" heading; the next line reads "Enter the code above to continue to Safer Chatbots for Children"; "This code expires in 10 minutes. If you didn’t request it, you can ignore this email." is small grey text. (user-originated)
- Membership agreement reminders, both copies: subject "One last step to join the Alliance"; the button links to the agreement step of the onboarding flow, not the tasks page. The original copy greets "Hi [name]," and its button reads "Join the Alliance"; the agreement copy's button reads "Become a member". (user-originated)
- These emails use neither "sign" nor "contract": "contract" becomes "agreement", and "sign the contract" becomes "complete the membership agreement". (user-originated)
- Suspension email: "suspended your agreement automatically" becomes "paused your agreement automatically. You can join again any time:", followed by a "Join again" button. (user-originated; the sentence ending is agent-proposed, user-approved)
- The original membership agreement reminder reads, in order: "Hi [name],"; "You’re almost done! You’ve created an account on the Alliance platform, but did not complete the membership agreement. Please note that until you do, you will be unable to participate in our projects."; "You can complete the membership agreement here:"; the "Join the Alliance" button; "The agreement matters because the Alliance is built on reliability. We plan precise actions based on the number of committed members; every commitment tells us who we can count on."; "By completing it, you’re telling other members that they can count on you. Because they’ve completed it, you can count on them too. The world needs you." (user-originated)
- Every email has a call-to-action button, except the one-time code email, which has none, and admin-written emails, where the button is optional. (user-originated)
- Action reminder emails get a "Begin" button that opens the task itself, so the member doesn't press begin again on the tasks page; "Complete within [days]" sits as small grey text under it. Reminders already saved are updated to match. With several tasks, "Begin" opens the first unfinished one. Deadline reminders also get "Begin"; missed-deadline notices get "See your tasks" to the tasks page; group-lead reminders get "See your group" to the group members page; project updates get "View update" to the task's page. The user receives an example "Begin" email to test. These ship in a later PR. (user-originated; destinations agent-proposed, user-approved)
- Admin-written waitlist emails get optional button label and link fields in the compose form; staff may send without a button. This ships in a later PR. (agent-proposed, user-approved as optional)
- Text messages and app notifications use "agreement" for "contract" and "paused" for "suspended". (agent-proposed, user-approved)
- The Kora signup confirmation is not shipped now; its design (text, button, logo) is documented for future projects with waitlists or a similar structure. (user-originated)
- The work is tracked in Linear. (agent-proposed, user-approved)
- Forum reply: the subject drops "on [post title]". (user-originated)
- Waitlist confirmation opens "You’re on the waitlist! We’ll email you when the project launches." (user-originated)
- Kora launch: subject "[Name]: Project launch"; body "The project has launched and your reviews are ready. It takes about an hour, and you can stop and pick up where you left off." (user-originated)
