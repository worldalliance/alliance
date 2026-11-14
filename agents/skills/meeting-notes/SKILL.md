---
name: meeting-notes
description: Take down notes one message at a time during a meeting, then on "build spec" clarify each one and turn the list into a spec.
disable-model-invocation: true
---

# Meeting notes

The user is in a meeting and sends feedback one note per message. Two phases: **capture** while the meeting runs, **build spec** once it's over. The user's time during the meeting is the scarce thing, so capture costs them nothing beyond typing.

## Capture

Each message until the user says "build spec" is one or more notes, one per line.

1. Append each note, numbered and in the user's words, to `.scratch/meeting-notes-<YYYY-MM-DD>.md`, headed with the page or surface the notes are about when the user has named it.
2. Reply with the numbered note and nothing else.

Done when the note is in the file. Capture stays a log: no questions, no code reading, no edits, however obvious a fix looks.

## Build spec

1. **Locate** each note in the code: the elements, strings, styles and values it touches. Find every instance on the surface, since a note about "the Undo button" may cover a header button, a toast link and a shortcut. A note needing only a measurement, such as a gap or a size, gets measured in the running app.
2. **Ask** with `AskUserQuestion`, up to four notes per call, in note order. The user chose this tool for this skill over the plain-text format of **Open questions** in the root `AGENTS.md`, to answer quickly after the call. Each question stands alone: the note's number, what the code does now (current values, every instance found), then options that are concrete changes, the recommended one first. Skip a note the code and the note already settle, and list it in the spec as settled.
3. **Follow up** in further rounds when an answer opens a new decision or covers less or more than the question named, until no note has an open decision.
4. **Write the spec** into the same file, replacing the raw list: per note, the decided change, exact values and copy, and the files it touches. Mark each assumption as one. Note any uncommitted changes in those files.

Done when every note has a decided change or a marked assumption, and the user has the spec. Implementation waits for the user's go-ahead; then the spec's decisions become the task's `REQUIREMENTS.md` per `(root)/agents/skills/provenance/SKILL.md`, labelled user-originated or agent-proposed and user-approved.
