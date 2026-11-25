---
user: Alex Dorey
task: A signed-in Kora waitlist participant still sees the navbar's login button; show them something else. Also make "The Alliance" in the header open a dropdown with a one-sentence blurb about the Alliance.
---

# Requirements

Both apply on Kora pages only: the Safer Chatbots for Children project page (`/projects/safer-chatbots-for-children`, including its sign-up view) and its review tool (`…/review`). Every other page keeps the navbar as it was. (agent-proposed, user-approved)

## Participant account menu

- A signed-in Kora participant sees, in place of the navbar's "Log In" button, a button with their name that opens a menu. (agent-proposed, user-approved)
- The menu shows "Signed in as" followed by their partly hidden contact, such as `•••0042` or `a•••@example.com`, and a "Sign out" item. The participant API returns that masked contact. (agent-proposed, user-approved)
- The project page no longer shows the "You're signed in as {name}." line or its sign-out icon; the navbar menu is the only place to sign out. (user-originated)

## "The Alliance" dropdown

- "The Alliance" in the header opens a dropdown instead of linking straight to the home page. (user-originated)
- The dropdown says: "A global group of people who spend 15 minutes a week on actions that measurably improve the world." (agent-proposed, user-approved)
- Below it, a "Learn more about the Alliance" link goes to the home page. (agent-proposed, user-approved)
