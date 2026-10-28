## Actions page

- "Draft or active" uses the existing status buckets (`actionStatusBucket`): Draft and Active. Onboarding and archived actions don't count. Each suite links to its suite page and shows its active and draft counts.

## Where the flow lives

- "Begin launch process" shows only while the suite has no members-taking-action event, so a launched suite never offers a second launch. The launch itself also refuses when one exists, in case an event is added while the panel is open.
- Everything runs on the client against existing endpoints: `evaluate-cohort`, the admin action and task-form queries, the suite event endpoint, and reminder group creation. No server change was needed.

## Schedule

- "PST" is read as Pacific time (`America/Los_Angeles`), so the defaults follow daylight saving. Both dates stay editable, with the Pacific time shown under each picker.
- The office event is 11:59pm Pacific, seven days after the day members start. When the member start rolls past midnight, the office event moves with it.
- The office event uses the `office_action` status ("Office taking action"), matching `CreateEventForm`'s deadline default.

## Sanity checks

- A member's actions are the suite actions whose cohort expression includes them, evaluated with `evaluate-cohort`, which counts active users only. Prerequisites are ignored, so the totals are an upper bound: someone who would only unlock a later action still counts it. Optional actions count too.
- Contract violations show in a red banner at the top of the panel and block launch until staff tick "Launch anyway, breaking the contract". Two contract terms are checkable at launch: a member assigned more than 15 minutes (the contract's 15-minute blocks), and office taking action less than 7 days after members start (its 7-day completion period). Its non-overlap term needs other suites' periods per member, left out with the cross-suite load. Its exceptions depend on a member's circumstances, which no launch check can see.
- Readiness reuses the action dashboard's checklist, now extracted to `actionReadiness.ts`, so both screens apply the same rules. It reads each action through the admin action query, because suite payloads don't load authors or the suite relation.
- Member preview lists each picked member's assigned actions, their total minutes, preview and edit links, and a "Log in as this member" impersonation link (the same endpoint the user detail page uses).
- "I checked this" boxes, dismissals, and the overload acknowledgment live in component state, so closing the panel resets them.
- n in "I am going to notify {n} real members" is the size of the union of the suite's action cohorts.
- The typed confirmation is required in every environment, unlike the reminders tab's, which skips it in development.

## Spelling and grammar

- Rule checks: double spaces between words (a markdown hard break, two trailing spaces, is allowed), back-to-back repeated words, a space before punctuation, and a missing space after sentence punctuation.
- Spelling uses `typo-js` with its bundled en_US Hunspell dictionary. The dictionary loads lazily (about 190 KB gzipped), only when the launch panel opens. Only lowercase words of three or more letters are checked, so names and acronyms aren't flagged. Curly apostrophes count as straight ones, so `isn’t` is checked whole. URLs (including bare `www.` ones), link targets, inline code, HTML tags, and email addresses are skipped.
- Checked text: the action's name, short description, body, and every member-facing text in its task form.
- Fixing means editing the action (an edit link opens it in a new tab) and re-running the checks. There is no in-place auto-fix. A dismissal is keyed by the finding's surrounding text, so it survives edits elsewhere in the same field. Findings with identical surrounding text, as when a form repeats a sentence, are numbered in order so each is dismissed on its own.

## Launch

- The sequence is: create the member event, then the office event, then the default reminder groups on the new member event. The default reminders come from the same list the reminders tab's "Populate default reminders" uses, now `defaultReminderBodies` in `presets.ts`.
- The steps aren't atomic. When one fails, the panel stays open and says exactly what was created and what's left to add by hand.

## Launch review additions

- Distribution: members are grouped by the exact set of suite actions they get, most common first, with each group's minutes. A button per group adds one of its members to the preview, so each distinct experience is one click from "Log in as this member".
- Reminder preview: the default reminders are listed by send time in Pacific time, computed with the office action event as the deadline. A reminder that would send before members start blocks launch, which happens when the window is shorter than three days.
- Each action row shows its cohort's member count and description, an edit link for its task form, and notes to weigh before "I checked this": archived, no cover image, and an empty cohort. The notes don't block, because a cohort that depends on an earlier action can be empty at launch and some actions go without an image.
- Placeholder text (TODO, TBD, TKTK, FIXME, lorem ipsum, `[insert …]`, `[add …]`, `[tbd …]`) is a text finding like the rest.
