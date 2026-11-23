# Decisions

## One Pug layout, a button mixin

Every live template extends `server/src/mail/templates/layout.pug`, which holds the card, the footer and a `button` mixin. Each template places the button where its bare URL sat, so the text around it keeps its order. A layout-level slot after the content would have moved a link that sits mid-email (password reset, contract reminder) to the end. (agent decision)

## Which templates

Only templates a sender reaches on `main` changed: welcome, password reset, contract suspended, reinstated and reminder, custom action reminder, forum reply, one-time code, the three waitlist emails, and the two Kora notices. `commitment`, `commitmentreminder`, `memberaction`, `memberactionreminder`, `misseddeadline`, `missedseconddeadline` and `digest` have no sender, so they stay as they are and are left for separate removal. (agent decision)

## Text kept, URLs become buttons

The text is unchanged, per the requirement. A bare URL became a button. A fragment whose only job was introducing the link ("Start reviewing:", "Review more:") became the button's label instead of sitting above a button that repeats it. Labels where the text named none are agent proposals for the user's copy review: "Verify email", "Reset password" or "Set password", "See your tasks", "Sign your contract", "Enter the agreement", "View comment". (agent decision)

## Waitlist emails: share link as text, button to the entrant's page

The waitlist confirmation and link emails hand the recipient a personal `?ref=` link to pass on, so that URL stays visible for copying. Their button, "Invite others", opens the `?link=` page, the entrant's own waitlist spot with its sharing controls; it uses the same code. (agent decision)

## Site URL from `APP_URL`

The footer links and the web fonts load from `siteBaseUrl()`, so staging emails point at staging. `renderHtml` throws when it is unset rather than rendering `undefined/people`; `APP_URL` is required in every deployed environment. (agent decision)

## Fonts and client support

The button and footer name TT Neoris and the logo Libre Caslon Text, loaded with `@font-face` from the site's `public/assets/fonts/redesign/`. Apple Mail loads them; Gmail and Outlook drop web fonts and fall back to system sans and Georgia. Element styles inside the content come from a `<style>` block, which Gmail and Apple Mail honour; the card, button and footer are inline-styled so they survive clients that strip it. (agent decision)

## Copy the user's changes left open

- The agreement link is `/onboarding?step=agreement`, the onboarding flow's agreement step; signing there ends a suspension too, so the suspension email's "Join again" uses it. The server builds the path by hand because the step enum lives in the frontend. (agent decision)
- "Without sign": "By signing" became "By completing it" and "By entering into it", "they’ve signed" became "they’ve completed it", "before signing" became "before joining", "You signed up for the Alliance" became "You created an account on the Alliance platform" and "You created an Alliance account", and the suspension subject "Alliance contract suspended" became "Alliance agreement paused". All are agent wording for the user's review. (agent decision)
- "[Name]" in the Kora launch subject is read as the project name, matching the subject it replaces ("Safer Chatbots for Children: reviews are open"). (agent interpretation)
- The one-time code line keeps `#{action}`, so the phone verification email reads "Enter the code above to confirm your phone number". (agent decision)
- Both contract reminder copies now share a subject, so the A/B test between them (#628) no longer varies the subject. (agent observation)
- The user's #5 copy ended "The world needs you...."; it is set as "The world needs you." with the video, thanks and sign-off paragraphs kept after it. (agent interpretation)
