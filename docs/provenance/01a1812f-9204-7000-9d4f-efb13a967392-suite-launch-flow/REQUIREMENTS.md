---
user: markzxu
task: Admin panel — surface in-progress suites on the actions page and add a guided suite launch flow
---

## Actions page

- On the admin "Actions" page, add a new section directly underneath the timeline listing the suites that have at least one draft or active action. (user)

## Suite launch flow

On the admin suite view:

- The launch process starts from a big button labeled "Begin launch process". (user)
- The flow pre-fills a "Members taking action" event at 7pm Pacific time on the current day. When 7pm is less than 30 minutes away or already past, it pre-fills the first whole hour at least 30 minutes after the current time. (user)
- The flow pre-fills an "Office taking action" event 7 days later at 11:59pm. (user)
- The flow runs sanity checks:
  - It flags any member whose assigned suite actions add up to more than 15 minutes. (user)
  - It checks that every readiness checklist item is satisfied for every action in the suite. (user)
  - It lets the admin select a list of members and preview all the actions assigned to each of them. (user)
  - It lists every action with buttons to preview and to edit it, plus a checkbox labeled "I checked this" next to each. (user)
  - It runs basic spelling and grammar checks, such as double spaces. These don't block on their own, but the admin has to either change the text or dismiss each finding. (user)
- A launch button asks the admin to type "I am going to notify {n} real members", where n is the number of members who will be notified. It then creates the two events and populates the default reminders. (user)

## Follow-ups

- "Begin launch process" spans the full width, with no rocket icon. (user)
- A text finding in the task form links to the task form editor. (user)
- "Preview members' actions" shows the distribution of members across action combinations above the member search. (user)
- Add what someone launching a suite would want close at hand, and the checks they would want run. (user)
- Leave weekly load across suites unchecked for now. (user)
- Call out loudly at launch any violation of the member contract. (user)
- The launch button spans the full width, with no rocket icon. (user)

## Verification

- Add tests, and confirm the change works and doesn't break existing behavior. (user)
