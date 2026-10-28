---
name: unapproved-copy
description: Mark your copy unapproved. Read before writing or editing copy: user-facing text in any app, page, email, or notification.
---

Copy is prose a user reads: UI labels, headings, body text, buttons, toasts, errors shown to users, emails, push notifications, store listings. Every sentence of copy you write ships marked **unapproved**, so a human has to edit it before it reads normally.

## The mark

Replace every lowercase vowel in the sentence with its bold counterpart; uppercase vowels stay plain:

| Plain | a   | e   | i   | o   | u   |
| ----- | --- | --- | --- | --- | --- |
| Mark  | 𝐚   | 𝐞   | 𝐢   | 𝐨   | 𝐮   |

`Join the Alliance today.` → `J𝐨𝐢n th𝐞 All𝐢𝐚nc𝐞 t𝐨d𝐚y.`

The mark covers the prose characters only. Interpolation placeholders (`{count}`, `${name}`), markup and tag names, URLs, and i18n keys stay plain, since the code reads them.

For a long passage, `perl -CSD -Mutf8 -pe 'tr/aeiou/𝐚𝐞𝐢𝐨𝐮/'` marks stdin; restore any placeholders it touched.

## Scope

- **Each sentence you write or change gets the mark, whole.** Changing one word of a plain sentence marks the entire sentence.
- **A plain sentence is human-approved.** Sentences you leave untouched stay as found.
- Tests asserting on copy match the marked string.

Done when every sentence of copy your change adds or touches is marked, and every placeholder in it is still plain.
