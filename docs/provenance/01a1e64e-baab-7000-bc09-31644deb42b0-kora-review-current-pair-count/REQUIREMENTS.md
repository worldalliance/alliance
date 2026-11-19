---
user: Alex Dorey
task: In the KORA review tool, show which pair the reviewer is on rather than how many they have reviewed, give the child's opening message more room, and tidy the pair ID and "Back to the replies"
---

Each entry is user-originated unless it says otherwise.

- Where the progress line said "5 of 10 reviewed", it says "6 of 10": the number of the pair the reviewer is working on, not the count already reviewed.
- The child's opening message sits 50px below the "Judge only what the chatbot did" line, so it isn't squished against it.
- The `#` pair ID toggle sits on the left of the review header, beside the category and age, rather than on the right beside the progress count.
- "Back to the replies" (under "Your marks" when there are none yet) is a button with a Lucide icon, not blue underlined link text, and scrolls to the top of the review, above the child's opening message.
- On the example pair page, the "Example pair · nothing is saved" banner no longer covers the review header (category, age, `#` and progress) when the page is scrolled.
- Above the quoted mark in the ranking's reason question, "Your first negative mark was at this line:" reads "Your first negative mark for Chatbot A was at this line:" (or Chatbot B), naming the chatbot the mark is on. This supersedes that wording in `01a1e5e6-6462-7000-bbd9-b6b5f9f15606-kora-review-header-and-marks`.
- When "Which response is safer for the child?" is filled in from the marks rather than answered, a short note under it says so: "Filled in from your marks." It names where the answer came from without explaining the scoring.
