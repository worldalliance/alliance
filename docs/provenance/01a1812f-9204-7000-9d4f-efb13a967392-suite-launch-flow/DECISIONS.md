## Actions page

- "Draft or active" uses the existing status buckets (`actionStatusBucket`): Draft and Active. Onboarding and archived actions don't count. Each suite links to its suite page and shows its active and draft counts.

## Where the flow lives

- "Begin launch process" shows only while the suite has no members-taking-action event, so a launched suite never offers a second launch. The launch itself also refuses when one exists, in case an event is added while the panel is open.
- Everything runs on the client against existing endpoints: `evaluate-cohort`, the admin action and task-form queries, the suite event endpoint, and reminder group creation. No server change was needed.

## Schedule

- "PST" is read as Pacific time (`America/Los_Angeles`), so the defaults follow daylight saving. Both dates stay editable, with the Pacific time shown under each picker.
- The office event is 11:59pm Pacific, seven days after the day members start. When the member start rolls past midnight, the office event moves with it.
- The office event uses the `office_action` status ("Office taking action"), matching `CreateEventForm`'s deadline default.
- How long members get reads as whole days counted the way the contract check counts them, by Pacific wall-clock time, then the real hours and minutes past the last whole day, so it never contradicts the contract banner. On the day clocks fall back, that remainder can read 24 hours or more.
- While the schedule is valid, the Schedule check states "Members have <duration> to complete their actions" in black body text under its title, not in the grey summary beside it. The origin of this placement and color is unrecorded.

## Sanity checks

- A member's actions are the suite actions whose cohort expression includes them, evaluated with `evaluate-cohort`, which counts active users only. For a regular (non-onboarding) action, only members with an active contract count, since the server admits a member only while they hold one; contract status is read as of now, not as of the launch time. For an onboarding action, only members who have never signed count, since the server admits one only if they never signed or first signed at or after its start, which at launch is still to come. A member away at any point between members and office taking action doesn't count either, since the server leaves them out of the roster and its reminders; away dates are read for the year ahead, or through office taking action when that is later. Prerequisites are ignored, so the totals are an upper bound: someone who would only unlock a later action still counts it. Optional actions count too.
- Contract violations show in a red banner at the top of the panel and block launch until staff tick "Launch anyway, breaking the contract". Two contract terms are checkable at launch: a member assigned more than 15 minutes (the contract's 15-minute blocks), and office taking action less than 7 days after members start (its 7-day completion period), counted by Pacific wall-clock time, so a deadline seven days out falls short when it is earlier in the day than members start, and the default 11:59pm deadline holds across a daylight saving change. Its non-overlap term needs other suites' periods per member, left out with the cross-suite load. Its exceptions depend on a member's circumstances, which no launch check can see.
- Readiness reuses the action dashboard's checklist, now extracted to `actionReadiness.ts`, so both screens apply the same rules, including the dashboard's "Image set" and "Task form has an output view, for the completion card" items: launch needs every action to have a cover image and a task form with an output view. It reads each action through the admin action query, because suite payloads don't load authors or the suite relation.
- Member preview lists each picked member's assigned actions, their total minutes, preview and edit links, and a "Log in as this member" impersonation link (the same endpoint the user detail page uses).
- The launch flow is its own page, `/suites/:suiteId/launch`. The schedule, "Ready to launch" boxes, dismissals, and the contract acknowledgment are saved in this browser's localStorage per suite, so a refresh or leaving and coming back keeps them; a successful launch clears them. They are per browser, not shared between staff.
- n in "I am going to notify {n} real members" is the size of the union of the suite's action cohorts: the members assigned at least one of its actions. The group leads the Group Leads reminders reach aren't counted unless they're assigned an action themselves: who they are depends on who hasn't finished when each reminder sends, so no count at launch is exact, and the required copy says "members". A reviewer, Charles Lien, left this choice to the agent. The launch confirmation's message adds a sentence saying so whenever a reminder goes to group leads, without changing the copy staff type.
- The typed confirmation is required in every environment, unlike the reminders tab's, which skips it in development.

## Spelling and grammar

- Rule checks: double spaces between words (a markdown hard break, two trailing spaces, is allowed), back-to-back repeated words, a space before punctuation, and a missing space after sentence punctuation.
- Spelling counts a word as known when either `typo-js`'s bundled en_US Hunspell dictionary (which handles inflections) or `an-array-of-english-words`, a 275k-word list with newer and compound words, has it. On the 114 local actions this cut misspelling flags from 67 (29 distinct words) to 29 (13), and the long list has some rare or archaic words that are mostly typos in practice ("wich", "wether", "persue", "calender", "publically"), so for those only Hunspell decides. A larger Hunspell dictionary (`dictionary-en`) didn't help: it is the same word list. Treating a word that splits into two known words as known let real typos through ("arguement"). Both dictionaries load lazily, only when the launch panel opens (about 190 KB and 730 KB gzipped). Only lowercase words of three or more letters are checked, so names and acronyms aren't flagged. Curly apostrophes count as straight ones, so `isn’t` is checked whole. URLs (including bare `www.` ones and bare lowercase domains, so a missing space before "Net" or "Us" is still caught), link targets, inline code, code fence labels, file names, HTML tags, and email addresses are skipped.
- A short list of Alliance terms (`grantmaking`, `grantmaker`, `grantmakers`) always counts as spelled right. A rule accepting any known word plus "making" was the alternative, but compound rules let real typos through.
- Dismissing a misspelling dismisses that word everywhere in the suite, possessives included, like "ignore word" in a spellchecker; other findings are dismissed one at a time.
- Checked text: the action's name, short description, body, and every member-facing text in its task form.
- Fixing means editing the action (an edit link opens it in a new tab) and re-running the checks. There is no in-place auto-fix. A dismissal is keyed by the finding's surrounding text, so it survives edits elsewhere in the same field. Findings with identical surrounding text, as when a form repeats a sentence, are numbered in order so each is dismissed on its own.

## Launch

- The sequence is: create the member event, then the office event, then the default reminder groups on the new member event. The default reminders come from the same list the reminders tab's "Populate default reminders" uses, now `defaultReminderBodies` in `presets.ts`.
- The steps aren't atomic. When one fails, the panel stays open and says exactly what was created and what's left to add by hand.

## Launch review additions

- Distribution: members are grouped by the exact set of suite actions they get, most common first, with each group's minutes. A button per group adds one of its members to the preview, so each distinct experience is one click from "Log in as this member".
- Reminder preview: the default reminders are listed by send time in Pacific time, computed with the office action event as the deadline. A reminder that would send before members start blocks launch, which happens when the window is shorter than three days.
- Each action row shows its cohort's member count and description, an edit link for its task form, and notes to weigh before "Ready to launch": archived and an empty cohort. The notes don't block, because a cohort that depends on an earlier action can be empty at launch. A missing cover image isn't noted, at staff's request. The readiness checklist's "Image set" item, which `main` added after that request (#888), still blocks launch until every action has a cover image; whether staff meant to launch without one is unrecorded, so this interaction of the two is open for Mark.
- Placeholder text (TODO, TBD, TKTK, FIXME, lorem ipsum, `[insert …]`, `[add …]`, `[tbd …]`) is a text finding like the rest. The capitalized markers match only in capitals, so "your todo list" passes, and a bracket that is a markdown link's text, such as `[Add to calendar](…)`, isn't a placeholder, nor does a placeholder bracket run on past it.
