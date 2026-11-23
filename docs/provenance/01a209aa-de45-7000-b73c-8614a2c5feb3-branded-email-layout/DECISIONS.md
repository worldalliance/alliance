# Decisions

## One Pug layout, a button mixin

Every live template extends `server/src/mail/templates/layout.pug`, which holds the card, the footer and a `button` mixin. Each template places the button where its bare URL sat, so the text around it keeps its order. A layout-level slot after the content would have moved a link that sits mid-email (password reset, contract reminder) to the end. (agent decision)

## Which templates

Only templates a sender reaches on `main` changed: welcome, password reset, contract suspended, reinstated and reminder, custom action reminder, forum reply, one-time code, the three waitlist emails, and the two Kora notices. `commitment`, `commitmentreminder`, `memberaction`, `memberactionreminder`, `misseddeadline`, `missedseconddeadline` and `digest` have no sender, so they stay as they are and are left for separate removal. (agent decision)

## Text kept, URLs become buttons

The text is unchanged, per the requirement. A bare URL became a button. A fragment whose only job was introducing the link ("Start reviewing:", "Review more:") became the button's label instead of sitting above a button that repeats it. Labels where the text named none are agent proposals for the user's copy review: "Verify email", "Reset password" or "Set password", "See your tasks", "Sign your contract", "Enter the agreement", "View comment". (agent decision)

## Waitlist emails: share link as text, button to the entrant's page

The waitlist confirmation and link emails hand the recipient a personal `?ref=` link to pass on, so that URL stays visible for copying. Their button, "Invite others", opens the `?link=` page, the entrant's own waitlist spot with its sharing controls; it uses the same code. Their "you can ignore this email" line is small grey text under the button, as the user set it for the welcome and password emails. (agent decision)

## Layout links don't count as clicks

The logotype and footer links carry `data-untracked`, which `tagHtmlLinks` skips. Otherwise they get the email's tracking id, and a tap on Home would count as a click on the email's button in the reminder click rates and the contract reminder experiment. (agent decision)

## Site URL from `APP_URL`

The footer links and the web fonts load from `siteBaseUrl()`, so staging emails point at staging. `renderHtml` throws when it is unset rather than rendering `undefined/people`; `APP_URL` is required in every deployed environment. (agent decision)

## Fonts and client support

The button and footer name TT Neoris and the logo Libre Caslon Text, loaded with `@font-face` from the site's `public/assets/fonts/redesign/`. Apple Mail loads them; Gmail and Outlook drop web fonts and fall back to system sans and Georgia. Element styles inside the content come from a `<style>` block, which Gmail and Apple Mail honour; the card, button and footer are inline-styled so they survive clients that strip it. (agent decision)

## Copy the user's changes left open

- The agreement link is `/onboarding?step=agreement`, the onboarding flow's agreement step; signing there ends a suspension too, so the suspension email's "Join again" uses it. The server builds the path by hand because the step enum lives in the frontend. (agent decision)
- The step was built for someone who had just made an account, and these emails reach people who already have one. Someone signed out who arrives there with nothing saved goes to log in and back, rather than to Create an account (a provider sign-in still loses the way back, ALL-2412); a member who has already entered the agreement goes on to their tasks; a member who joins again after a pause returns to their tasks rather than the new-member walkthrough. (agent decision)
- "Without sign": "By signing" became "By completing it" and "By entering into it", "they’ve signed" became "they’ve completed it", "before signing" became "before joining", "You signed up for the Alliance" became "You created an account on the Alliance platform" and "You created an Alliance account", and the suspension subject "Alliance contract suspended" became "Alliance agreement paused". All are agent wording for the user's review. (agent decision)
- "[Name]" in the Kora launch subject is read as the project name, matching the subject it replaces ("Safer Chatbots for Children: reviews are open"). (agent interpretation)
- The one-time code line keeps `#{action}`, so the phone verification email reads "Enter the code above to confirm your phone number". (agent decision)
- The reworded contract reminder copies record new values, `control_v2` and `agreement_v2`, since `ContractReminderCopy` gives a reworded copy a new value; the old `control` and `agreement_v1` stay parseable for the contexts already stored. Members keep their arms, so the A/B test (#628) goes on, now varying only the body and button label: both copies share the subject and the destination. (agent decision)
- The user's #5 copy ended "The world needs you...."; it is set as "The world needs you." with the video, thanks and sign-off paragraphs kept after it. (agent interpretation)
