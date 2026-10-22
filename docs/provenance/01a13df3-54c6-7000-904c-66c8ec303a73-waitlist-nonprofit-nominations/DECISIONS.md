# Decisions

- Label the field “Nonprofits you’d nominate (optional)” and use a resizable, single-row textarea with an inline save icon. Pending and saved icons keep feedback within the same row; errors remain visible below. Use tighter spacing and a single input row to reduce height while preserving the original confirmation typography and sharing copy.
- Authorize changes using the existing HttpOnly waitlist browser session. Public sharing codes cannot authorize edits. Restore the saved response with browser state. Visitors without a remembered entry cannot edit an entry merely by entering its contact details.
- Store optional free text, limited to 4,000 characters, on the waitlist entry. Trim submissions and store blank responses as null. Display the full response in a separate admin table column.
- This project signup page exists only on the public website; there is no corresponding mobile waitlist screen.
