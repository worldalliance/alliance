---
user: Alex Dorey
task: Assign each member one row of an admin-supplied list in an action form, and show and save that row's values
---

## User-origin requirements

- An admin embeds a list of records in an action form. Each member is assigned one row, and the form shows that row's values. The motivating list is California jurisdictions for public records requests, each row shaped like:

  ```json
  {
    "jurisdiction": "Burbank",
    "type": "City",
    "county": "Los Angeles",
    "prrFilingMode": "Email",
    "prrWebsite": "https://www.burbankca.gov/web/city-clerks-office/public-records-request",
    "email": "cityclerks@burbankca.gov"
  }
  ```

  Values can be `null`, e.g. a jurisdiction with no records email.

- The final list will have more than 200 rows.
- It works on day 1 for every installed version of the mobile app. A form using the list must not break, block or misrender on any build already in members' hands.
- Ideally the member's row is saved with their response in the form response table.

## Agent-proposed, user-approved

### Assignment

- The server picks the row and fills its values into the form it serves. Clients receive plain form content with nothing new to interpret, so every app version renders it.
- A member's row is stored the first time the form is fetched for them, i.e. when they open the action's task. Loading the action feed does not assign a row.
- Assignment is balanced: a new member gets the row with the fewest counted assignments. A row's count includes every assignment except unsubmitted ones older than 7 days (a fixed constant). A member whose assignment went stale keeps their row; it just stops counting.
- A stored assignment survives list edits. Adding, reordering or editing rows doesn't move anyone.
- Assignments are keyed on the member's user id. A form with a row list is for signed-in members only: for anyone not signed in, loading it is refused and the app shows its existing error, and a guest submission to it is refused.
- Each form has its own list, assignments and balance. Each form variant of an action has its own list, or none.
- One list per form.
- If an edit removes a row, members assigned to it who haven't submitted get a new balanced row the next time they fetch the form. Members who submitted keep the copy saved on their response.

### The list

- The admin pastes the list as JSON in the form builder: an array of flat objects whose values are text, numbers, yes/no or `null`. It is validated on save.
- The admin picks the field or fields that identify a row (e.g. `jurisdiction` + `type`, since San Bernardino is both a city and a county). Saving fails if two rows share a key. A fix to a row's values reaches the members already assigned to it.
- The builder refuses to save an empty list.

### Using row values

- Placeholders read the member's row as `#{row.<field>}`. They are allowed in display text blocks (text, header, quote), field labels and descriptions, field default values (prefilled answers the member can edit), and link URLs.
- A `null` or missing value fills in as empty text.
- Display blocks and question fields, but not pages, can carry a row condition. The supported comparisons are: field equals or doesn't equal a value, has a value or is empty, and is one of several values. The server drops blocks and fields whose condition fails before serving the form. A hidden required field is not required for that member, and the server's submit check applies the same rule.
- Variable formulas cannot read the row. Row values reach the form only through placeholders and row conditions.
- Output views (the response shown to other members, e.g. on activity cards) can use row placeholders. The server fills them from the copy saved on the response, so any field used there is visible to whoever sees the output.

### Saving and admin views

- A submission stores the row's key and a copy of its values at submit time, in a new column on the form response.
- The admin responses table and CSV export show one column per row field.
- The form builder preview has a row picker. Placeholders and row conditions preview as that row would.

### Failure

- If assignment fails on the server, the form fetch fails and the app shows its existing load error, rather than a form with blank values.

### Out of scope

- Admins reassigning a member to a different row.
- Changing the client-side `random` variable input from PR #731. It stays as it is.
