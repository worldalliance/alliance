---
user: Alex Dorey
task: Spec a change to the `/demo-action` skill so it can generate a standalone HTML page with a list of directions for the workflow of creating a new action, e.g. `/demo-action html page: a single environment-related action that has a narrow cohort and launches tomorrow at 7pm`.
---

# Requirements

## Mode

- `/demo-action` gains an HTML-page mode, asked for in the prompt (e.g. `html page: <description of the action>`). The description sets the action's topic, cohort and launch time; the skill invents the rest. (user-originated)
- The page is a numbered list of directions a staff member follows by hand in the local admin panel to create the described action: its form, the action itself, its cohort and its scheduled release. (agent-proposed, user-approved)
- In this mode the skill writes nothing to the local database: the page is the whole output, and the person following it creates everything. (agent-proposed, user-approved)

## Content of the directions

- The skill derives the steps from the current admin source on every run (routes, button and field labels, the cohort builder, the release scheduling UI), so the directions match the admin as it is. It does not rehearse them in the browser. (agent-proposed, user-approved)
- The directions start from the Actions page's create menu by default. When the prompt asks for another path, such as a project or a suite, they follow that path instead. (user-originated)
- A narrow cohort is chosen by the agent to fit the topic, using only tags, actions and form answers that exist in the local database, so the cohort matches real local members. (agent-proposed, user-approved)
- Times in the prompt, such as "tomorrow at 7pm", are Pacific time, and the page gives them in the form the admin's inputs take. (agent-proposed, user-approved)
- Every piece of content the person enters (the action's name, short description, markdown body, and each form field) has a one-click copy button. (agent-proposed, user-approved)

## Output

- The page is a single self-contained file (inline CSS and JS, no network requests) at `.scratch/demo/pages/<slug>.html`, and the skill opens it in the browser pane when done. (agent-proposed, user-approved)
