---
user: Charles Lien
task: ALL-2219, admin editors save site links as relative paths
---

- Admins may still save absolute links to the site. Saving content that holds one first warns them in a confirmation dialog, as the worldalliance dialog does; confirming saves the content unchanged, cancelling saves nothing. Nothing rewrites links on save. (user-originated)
- The link warning covers the action editor, the form builder (forms, action updates and general updates) and the staff directory. Reminder emails and texts keep absolute links, since they are sent as stored and a relative link can't be opened from an SMS or email. (agent-proposed, user-approved)
- The worldalliance warning keeps flagging every mention of worldalliance, links to the site's old-domain hosts included. (user-originated)
- The link warning and the worldalliance warning are one dialog, showing only the sections that apply, with each problem listed once: a worldalliance.org link to the site appears only in the link section. Copy: title "Save anyway?"; link section "Links to the site should be paths, such as /actions/53, so they keep working if the domain changes:" followed by excerpts; worldalliance section: a sentence followed by excerpts; button "Save anyway". (agent-proposed, user-approved)
- Image sources go out as stored, upload keys included, and clients resolve keys: `getForm` stops rendering an image block's `src` as a URL, so an editor sends back the key it was served. Nothing rewrites image URLs on save; turning URLs already stored into keys is a one-off migration in ALL-2220. A legacy app that echoes the old served shape, keys rendered as URLs, is still accepted. (agent-proposed, user-approved)
- The quote block stores the picked member's picture as its upload key, which the admin users list returns alongside the rendered URL, and it is served as stored. (agent-proposed, user-approved)
- Fix ALL-1998 in this change: the mobile app opens a relative link whose query or fragment holds a colon, such as `faq?t=10:30`, on the site, as it does other relative links with no app screen. (agent-proposed, user-approved)
- Commit on the `domain` branch. (user-originated)
