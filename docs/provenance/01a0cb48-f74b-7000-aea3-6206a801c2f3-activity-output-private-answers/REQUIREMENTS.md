---
user: Charles Lien
task: Stop the activity feed from sending a respondent's private answers
---

A reviewing agent reported that the server sends every answer of a form response with an activity, private ones included, and leaves hiding them to the web and mobile output renderers. Anyone who can load the activity can read those answers from the network response.

The user asked to fix every finding in that review.

Asked how, the user chose the agent's proposal that the server resolves the output: it sends only the public answers the output view shows, along with the variable values and block visibility it works out itself, so nothing private leaves the server. The proposal accepted that an app build already released might show the wrong thing where a condition or variable reads a private answer.
