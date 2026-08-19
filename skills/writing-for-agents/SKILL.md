---
name: writing-for-agents
description: Read before writing or editing any doc primarily meant for agents — SKILL.md, AGENTS.md, CLAUDE.md, docs those point at.
---

Reference for writing any document an agent consumes: a skill, an `AGENTS.md` / `CLAUDE.md`, a doc reached by a pointer. The packaging differs; the writing does not. The same levers make each one predictable, since the agent takes the same _process_ every run rather than producing the same output.

When the document you're writing is a skill, read [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md) for frontmatter, invocation choice, and router skills.

## The pass

Every edit to an agent-facing document makes this pass:

1. Place it: **where the rule goes**.
2. Write it positively, and only if it **earns space**.
3. Correcting an earlier version? The diff is a replacement: **after a correction**.
4. Prune, until every sentence you added or changed survives the test in **pruning**.

Done when each rule below has been applied to each line you touched.

## Where the rule goes

- **True across a subtree, always** → the nearest `AGENTS.md`. The root one loads every turn, so it holds rules, not procedures.
- **Needed only for one kind of task** → a skill.
- **`CLAUDE.md` is `@AGENTS.md` and nothing else.** Write below that line only for a rule other harnesses genuinely don't need.

Skills auto-load in Claude only; every other agent reads `AGENTS.md` alone. So every skill a model can invoke also gets a one-line pointer from the nearest `AGENTS.md`, naming the skill and the branches that reach it. That line and the skill's own `description` are one fact written for two readers who never both see it: deliberate duplication, and the exception to single source of truth below.

## What earns space

A line earns its load by changing what the agent does. The recurring wins:

- **Values it cannot derive**: ports, bundle ids, credential locations, paths `grep` won't surface.
- **Failure → cause**: "red screen, `native binding not a function` → the installed build predates the native dep change; rebuild with X."
- **Choices whose right answer looks wrong**, plus the clause that stops the next agent "fixing" it.
- **The reason behind a rule**, where the reason is what lets the agent settle the cases the rule doesn't name. Where the rule is absolute and admits no edge, the reason is load with no job.

Name the tool, not the incantation: "Postgres creds in `server/.env`" beats a `psql` tutorial. Put paths inside the command that uses them (`~/.maestro/bin/maestro test`) rather than in prose about them.

## Context pointers

A **context pointer** is a reference held in the agent's context that names some out-of-context material and encodes the condition for reaching it. A skill's description is one; a line in `AGENTS.md` naming a doc is the same object. The pointer's _wording_, not its target, decides when the agent reaches the material, and how reliably. A must-have target behind a weakly worded pointer is a variance bug. Sharpen the wording first, and inline the material only if sharpening fails.

A pointer does two jobs: state what the material is, and list the **branches** that should trigger reaching it (a branch is a distinct case the document handles, so different runs take different paths through it). Every word of an always-loaded pointer costs on every turn, so it earns even harder pruning than the body:

- **Front-load the leading word**: the pointer is where it does its triggering work.
- **One trigger per branch.** Synonyms that rename a single branch are one branch written twice; collapse them and keep only genuinely distinct branches.
- **Cut identity the body already carries.**

## The two loads

Every document and pointer you add spends one of two budgets:

- **Context load** is the cost of always-loaded material on the agent's window: an `AGENTS.md` line, a skill description, anything sitting in context every turn, spending tokens and attention whether or not it fires.
- **Cognitive load** is the cost on the human: which documents exist and when to reach for each. The human is the index. This is the one load worth paying: it buys human agency, so spend it where human judgment matters and remove it where it does not.

Material reached only through a pointer escapes context load at the price of the pointer's own line; material with no pointer at all rides entirely on cognitive load.

## Information hierarchy

A document is built from two content types: **steps** (the ordered actions the agent performs) and **reference** (definitions, rules, facts consulted on demand). The two mix freely: all steps (a recipe), all reference (a review's rules), or both. The core decision is where each piece sits on the **information hierarchy**, a ladder ranked by how immediately the agent needs the material:

1. **In-file step** is the primary tier: what the agent does, in order.
2. **In-file reference** is consulted on demand. Often a legitimately flat peer-set (every rule of a review on one rung), which is a fine arrangement, not a smell.
3. **Disclosed reference** is pushed out into a separate file, reached by a context pointer, loaded only when the pointer fires. Spans a sibling file in the same folder through fully external reference that lives anywhere and any document can point at.

Push too little down and the top bloats; push too much and you hide material the agent actually needs. That tension is the whole decision.

**Progressive disclosure** is the move down the ladder (out of the main file and behind a pointer) so the top stays legible. Protecting the hierarchy matters more than the tokens it saves. Branching is the cleanest disclosure test: inline what every branch needs, and push behind a pointer what only some branches reach. When a document has steps, in-file reference that should be disclosed buries them and turns attending to them into a coin-flip. The cost lands on variance as much as on legibility.

**Co-location** is the within-file companion. Where the ladder decides _how far down_ a piece sits, co-location decides _what sits beside it_ once there. Keep a concept's definition, rules, and caveats under one heading rather than scattered, so reading one part brings its neighbors with it. The test: the document should read like documentation written for the agent. Grouped material reads that way; scattered material does not. (Distinct from duplication, which repeats one meaning in two places; scattering fragments one meaning across many.)

**Sprawl** is the failure mode here: a document simply too long, even when every line is live and unique. Attention thins across the excess, and every extra line is one more to keep relevant. The cure is the ladder: disclose reference behind pointers, and split by branch or sequence so each path carries only what it needs.

## Steps and completion criteria

Every step ends on a **completion criterion**, the condition that tells the agent the work is done. Two properties make it a lever:

- **Clarity**: can the agent tell done from not-done? A vague bound ("understanding reached") invites **premature completion**: ending the step before it is genuinely done, attention slipping to _being done_. The visible steps still ahead (the **post-completion steps**) supply the pull; the criterion's clarity is the resistance. Defend in order: **sharpen the bound first** (local and cheap); only if it is irreducibly fuzzy _and_ you observe the rush, hide the later steps by splitting the sequence. Hiding only works across a real context boundary (a hand-off or a subagent dispatch; an inline call leaves the later steps in context and clears nothing).
- **Demand**: how much it requires. "Every modified model accounted for" forces thorough work where "produce a change list" does not. Demand drives **legwork** (the digging the agent does within the work, latent in the wording rather than written as its own step), and it is not step-bound: "every rule applied" binds a body of flat reference just as "every step done" binds a sequence, which is how an all-reference document still carries an exhaustiveness bar.

The strongest criteria are both checkable and exhaustive.

## When to split

Splitting one document into two spends one of the two loads, so split only when the cut earns it:

- **By sequence**: split a run of steps where the post-completion steps tempt the agent to rush the one in front of it. Keeping them out of view drives more legwork on the current task. Beware the reverse: merging sequences exposes each step's later steps to what follows, inviting premature completion.
- **By invocation**, skill-specific: see [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md).

## Leading words

A **leading word** is a compact concept already living in the model's pretraining that the agent thinks with while running the document (_lesson_, _fog of war_, _tracer bullets_). Repeated as a token, never as a sentence, it accumulates a distributed definition and anchors a whole region of behavior in the fewest tokens, by recruiting priors the model already holds. Coining your own works if you define it clearly, but a made-up word recruits no priors, so you pay in definition tokens what a pretrained word gives free. Reach for an existing word first.

Leading words survive an `unslop` pass. Its abstract-metaphor-noun rule targets the metaphor dropped once for flavor, where a plainer word does the same job. A leading word is defined where it first appears and repeated as the same token every time, which is the whole mechanism. Keep those.

It anchors twice. In the body, _execution_: the agent reaches for the same behavior every time the word appears, and inside flat reference it focuses attention on a class of thing to look for. In a pointer, _invocation_: when the same word lives in your prompts, your docs, and your codebase, the agent links that shared language to the material and reaches it more reliably.

Hunt for opportunities to refactor with leading words. A triad spelled out at three sites, a pointer spending a sentence to gesture at one idea. Each is a passage begging to collapse into a single token:

- "fast, deterministic, low-overhead" → _tight_ (a _tight_ loop).
- "a loop you believe in" → _red_, turning a fuzzy gate into a binary observable state (the loop goes _red_ on the bug, or it doesn't).

You win twice: fewer tokens, and a sharper hook for the agent to hang its thinking on. Assume every document is carrying restatements that leading words retire. Go find them.

**Negation** is the failure mode beside this lever: steering by prohibition drags the forbidden behavior into context and makes it _more_ available, not less. _Don't think of an elephant_, and the elephant is all there is; the negation is a weak modifier the strongly-activated concept overruns, so the ban half-reads as an instruction to do the thing. Prompt the **positive**: state the target behavior ("write one-line comments") so the banned one is never spoken. A prohibition earns its place only as a hard guardrail you cannot phrase positively; even then, pair it with the positive target so attention lands on what to do.

## After a correction

A correction gives you the new rule. The document states the new rule and only the new rule. Find the line that produced the wrong behavior, and rewrite that line in place.

Leaving the old rule standing beside its replacement is **negation** written into the file. "Don't do X, do Y instead" keeps X in the document and keeps it available, and it costs load on every future read to say what the file already stopped saying.

Two checks, because a correction is the one edit you cannot judge from the inside:

- **The reader test.** The finished document reads as if the wrong version never existed. Someone who never saw the correction cannot tell what changed, and no line is legible only to a reader who saw the previous version.
- **The diff test.** A correction produces a replacement: lines removed as well as added. An edit that is only additions means the old rule is still there and you wrote a second one next to it.

Same for the record of the correction itself. Change history, migration notes, and reorg rationale describe the document's past; the agent acts on its present.

## Pruning

- Keep each meaning in a **single source of truth**: one authoritative place, so changing the behavior is a one-place edit. **Duplication** (the same meaning in more than one place) costs maintenance and tokens, and inflates a meaning's prominence on the ladder past its real rank. (The accidental inverse of a leading word, which repeats a token on purpose, never the meaning.) Within one document this is absolute: an inline value _and_ a pointer to the file defining it are one meaning twice, so pick one. Across documents a copy earns its keep when the two audiences never both see it.
- The **environment** is a source of truth too (`package.json` scripts, config files, the directory layout, `--help` output), and a document that restates it is a **cache**: a copy of a lookup, earning its load only when the lookup is expensive. Cache what the agent cannot find by looking: the unwritten convention, the reason behind a choice, the gotcha no config confesses. Anything one `grep`, `ls`, or `--help` away is a cheap lookup: where the routes live, SQL against named tables, standard CLI flags. Those belong to the environment, where they cannot go stale.
- Check every line for **relevance**: does it still bear on what the document does? A line loses relevance by never bearing on the task (mere exposition, or a branch that should be disclosed) or by going stale as the behavior or world it describes changes. Shorter documents are easier to keep relevant. Without a pruning discipline the default fate is **sediment**: stale layers that settle because adding feels safe and removing feels risky, until you must core down through them to find what is still live.
- Hunt **no-ops** sentence by sentence: an instruction the model already obeys by default pays load to say nothing. Test each one by deleting it and naming the action the agent now takes differently. Name a divergent action and the sentence earns its place. Name none and it stays deleted. The test is model-relative, not reader-relative, so two people disagreeing about a no-op disagree about the default, and they settle it by running the document rather than by debate. When a sentence fails, delete the whole sentence rather than trim words from it. Cutting whole units keeps what survives fully legible, where shaving words degrades every sentence at once and buys back little. The test also grades leading words: a word too weak to beat the default (_be thorough_ when the agent is already thorough-ish) is a no-op, and the fix is a stronger word (_relentless_), not a different technique.
  - **Reassurance** is the no-op that survives longest, because writing it feels like heading off a mistake. It answers a question the agent never asked, in the form _X is already set, so Y works normally_. "The fixtures are committed, so the suite runs on a fresh clone" changes nothing, since an agent told to run the suite runs it either way. The tells are _without changes_, _as usual_, _as expected_, _automatically_, _no need to_, _just works_. Each one is a sentence claiming the default is the default, so they are greppable.
