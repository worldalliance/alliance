# Decisions

- **Save and Cancel reuse the comment composer's buttons.** The reply edit form in `apps/frontend/src/components/forum/ReplyComponent.tsx` now uses the shared `Button` with `ButtonColor.Stone` for Save and `ButtonColor.Grey` for Cancel, at the default size, which is what the comment composer (`apps/frontend/src/components/forum/ReplyForm.tsx`) uses for Post and Cancel. Editing a comment and posting one are the same job on the same surface, so they look the same. Rejected: `ButtonColor.SitePrimary`, which is navy (`--site-primary: #081e40`) and used only on static pages, nowhere in the comment UI; `ButtonColor.Green`, whose white text on `--color-green` measures about 3.2:1, under the 4.5:1 text contrast `ux-guidelines` requires (EVIDENCE.md, Contrast). (agent decision)
- **Cancel sits left of Save**, as in the composer, which renders Cancel then Post. The buttons are in that order in the DOM too, so tab order follows the visual order. (agent decision)
- **Left as they are:** `CommentActionsMenu` and both `ForumCommentCard`s have no blue, and green link text stays as it is. Mobile's edit controls already match the scheme: editing renders the same `EditableContentForm` submit and Cancel as the mobile composer, with a green submit. (agent decision)

## Choices the owner left to the agent

- Edit Save button colour: the owner answered "I don't care" on how it's done, so the choice stays with the agent. Save stays dark grey (`ButtonColor.Stone`), matching the composer's Post button.
