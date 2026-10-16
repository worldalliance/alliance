# Split UserProfilePage under the 500-line limit

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

- The fix is splitting the file with no behavior change. Layout, from the options `codex exec` proposed per the repo's file-size rule: `apps/frontend/src/components/UserProfileCard.tsx` takes the profile card (avatar, name and badges, bio, the friend, message and edit controls) with the friend mutations, their handlers, and the avatar-editor key. `UserProfilePage.tsx` keeps profile loading, tab selection, the tab pills (passed to the card as children), and the tab content.
- The page still calls `useUserFriendStatusQuery` and `useProfileDraft` and passes their results to the card. The card mounts only once the profile has loaded, and unmounts behind the profile error screen. Calling the friend-status query there would start its request only after the profile arrives, and calling `useProfileDraft` there would drop an unsaved edit when a profile refetch fails. `UserProfilePage.test.tsx` covers both.
- The boundary follows mobile's `apps/mobile/components/member/ProfileHeader.tsx`, which takes `{ profile, isMe, children }`, while its screen starts the friend-status query early the same way. The two stay separate components: their markup and platform primitives differ, and the shared logic already lives in `shared/lib/useProfileDraft.ts` and `shared/lib/user.ts`.
- `sharedweb/ui/UserDisplayName.tsx` also renders role badges, but as icons; the profile page's labeled badges move unchanged rather than switching to it.
- The avatar-editor reset that ran on the route `id` now runs in the card on `profile.id`, which changes with it. The Observer badge drops its `!profilePending` check: the page renders the card only after the profile has loaded.
- One commit: the extraction is what brings the page under the limit.
