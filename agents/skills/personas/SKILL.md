---
name: personas
description: Create or update the personas and scenarios in docs/personas and docs/scenarios, and commit them.
disable-model-invocation: true
---

# Personas and scenarios

The library serves design and UX review: an agent or designer judges a UI or spec as a specific person trying to get something done. A **persona** is that person, in `docs/personas/<slug>.md`. A **scenario** is one goal that person pursues across the real screens, in `docs/scenarios/<slug>.md`; it names the personas it applies to, and personas name no scenarios. Slugs are kebab-case and describe the person or goal (`first-time-mobile-member`, `sign-a-petition-from-email`).

Personas are synthetic: no persona is based on an identifiable member or employee, and every file is free of personal information, since the repository is open source.

## Steps

1. **Library.** `ls docs/personas docs/scenarios` and read every file near the request. Update an existing persona or scenario over adding a near-duplicate. Done when you can name which files this run adds and which it changes.
2. **Code.** Read the code behind each surface a scenario touches: the role and permissions the persona has, the routes, the screens and their copy, the empty, loading and error states. Done when every journey step you plan maps to a screen you have opened in the code.
3. **Interview.** Ask the user with the `AskUserQuestion` tool, in place of the plain-text message root `AGENTS.md` **Open questions** prescribes, about every persona trait: who the person is, their goals, context, comfort with technology, access needs and concerns. Offer proposed traits as its options, recommendation first; a trait goes in only when the user stated or chose it. Ask too where the code allows more than one journey. Done when you can't name an open question whose answer would change a file.
4. **Write.** Follow the templates below. A rename updates every scenario naming the old slug; removing a persona that a scenario names needs the user's call on that scenario.
5. **Provenance.** Follow `(root)/agents/skills/provenance/SKILL.md`. The user's answers are the task's requirements; the files are where they land.
6. **Check.** Every slug a scenario names has a persona file, and every path a scenario cites exists:

   ```bash
   for f in docs/scenarios/*.md; do
     sed -n 's/^personas: *\[\(.*\)\]/\1/p' "$f" | tr ',' '\n' | tr -d ' ' | while read -r s; do [ -f "docs/personas/$s.md" ] || echo "$f: no persona $s"; done
     grep -o '`[^`]*\.tsx\?`' "$f" | tr -d '`' | while read -r p; do [ -f "$p" ] || echo "$f: no file $p"; done
   done
   ```

   Done when it prints nothing and every file you wrote is free of personal information.

7. **Commit.** Show the user the files and ask before committing, naming the branch; a branch holding other work gets the user's call on where this goes. Commit on their yes.

## Persona template

```markdown
# <Synthetic first name>: <who they are, one line>

- **Role**: <member, organizer, admin…>, using <web, mobile, admin panel>
- **Goals**: <what they come to the Alliance to do>
- **Context**: <device, setting, how often, how much time they have>
- **Comfort with technology**: <…>
- **Access needs**: <assistive technology, vision, motor, language and reading level, or none>
- **Concerns**: <what makes them hesitate or give up: trust, privacy, time…>
```

Every field holds what the user stated or approved, `none` included.

## Scenario template

```markdown
---
personas: [<slug>, <slug>]
---

# <The goal, in the persona's words>

- **Trigger**: <what brings them: an email, a push notification, a shared link>
- **Starting point**: <where they are and in what state: signed out, first visit, mid-campaign>

## Journey

1. <Screen as the user sees it> (`<route>`, `<path/to/Component.tsx>`): <what they do, and what they need to see to carry on>

**Done when**: <the success they can see>

## Where it goes wrong

- <A failure state the code has, with the copy it shows>
```
