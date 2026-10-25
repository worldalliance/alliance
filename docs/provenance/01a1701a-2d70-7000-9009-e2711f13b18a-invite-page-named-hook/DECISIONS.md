# Invite page on `useInvite`

- `useInvite` already owns both lookups and their cache entries (`queryKeys.referrerProfile`, `queryKeys.onetimeInvite`), and `InviteSessionProvider` runs it for the same code on this page, so the page reads the shared cache rather than issuing its own requests.
- `useInvite` gains an `onetimeInvite` field for the invitee's name and group, because the page needs both and the hook exposed neither.
- `onetimeInvite` is null when the invite is refused, matching `inviter`. On a used or unapproved onetime invite the page therefore shows the generic invitation without the inviter line, the invitee's name, or the group sentence, as onboarding already treats a refused code as naming no one. Before, the page named everyone on a refused link.
- The page drops its own campaign/user switch, since `inviter` is already null for a campaign.
