---
personas: [kora-project-admin]
---

# Load KORA's new transcripts and open them for rating

Unbuilt: no code has the Kora admin page, the transcript upload, or the project status. This scenario is the journey that feature is designed against.

- **Trigger**: KORA sends Priya a new `.jsonl` file of chatbot transcripts, and she wants volunteers rating them that day
- **Starting point**: signed in to the admin panel on her laptop, with the Kora project Pending

## Journey

1. Kora admin page in the admin panel (unbuilt): she finds the transcript upload and the project status. Active is disabled, and a note says transcripts must be uploaded first.
2. Upload (unbuilt): she chooses KORA's `.jsonl` file, which holds one transcript per line.
3. Upload result (unbuilt): she sees how many transcripts were read and a randomly picked transcript shown as participants will see it, so she can confirm the file is the batch she expects.
4. Status control (unbuilt): she switches the project from Pending to Active, which opens rating for signed-in participants.
5. Public project page (`/projects/safer-chatbots-for-children`, `apps/frontend/src/components/projects/safer-chatbots-for-children-26/SaferChatbotsForChildren26.tsx`): on her phone, she checks that rating is open.

**Done when**: the admin page shows the project as Active with the uploaded transcript count, and signed-in participants can start rating on the project page.

## Where it goes wrong

- A line in the file is invalid: nothing is imported, and she sees the rejected lines by line number so she can send them back to KORA. The project stays Pending.
- She tries to activate before uploading: Active is disabled, with the note that transcripts must be uploaded first.
